#![allow(nonstandard_style)]

use crate::native_apps::watch_process_event::WatchProcessEvent;
use futures_util::{StreamExt, stream};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use std::{
    ffi::{c_uchar, c_ulong, c_ushort, c_void},
    marker::PhantomData,
    mem::{self, MaybeUninit},
    ops::Deref,
    slice, thread,
};
use sysinfo::{Pid, System};
use tauri::ipc::Channel;
use tokio::sync::Semaphore;
use tracing::{debug, error, info, trace, warn};
use windows::Win32::System::Threading::{
    PROCESS_DUP_HANDLE, PROCESS_QUERY_INFORMATION, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::{
    Wdk::{
        Foundation::{
            NtQueryObject, OBJECT_INFORMATION_CLASS, OBJECT_NAME_INFORMATION, ObjectTypeInformation,
        },
        System::SystemInformation::{NtQuerySystemInformation, SYSTEM_INFORMATION_CLASS},
    },
    Win32::{
        Foundation::{
            BOOL, CloseHandle, DUPLICATE_CLOSE_SOURCE, DUPLICATE_SAME_ACCESS, DuplicateHandle,
            HANDLE, NTSTATUS,
        },
        System::Threading::{GetCurrentProcess, OpenProcess, PROCESS_ALL_ACCESS},
    },
};

windows_targets::link!("ntdll.dll" "system" fn NtDuplicateObject(source_process_handle: HANDLE, source_handle: HANDLE, target_process_handle: HANDLE, target_handle: *mut c_void, access_mask: u32, attributes: u32, roptions: u32) -> NTSTATUS);

/// Declare this function by self, because it is not present in the windows crate.
#[inline]
pub unsafe fn _NtDuplicateObject<P0>(
    source_process_handle: P0,
    source_handle: P0,
    target_process_handle: P0,
    target_handle: Option<*mut ::core::ffi::c_void>,
    access_mask: u32,
    attributes: u32,
    options: u32,
) -> windows::core::Result<()>
where
    P0: windows::core::IntoParam<HANDLE>,
{
    let status = NtDuplicateObject(
        source_process_handle.into_param().abi(),
        source_handle.into_param().abi(),
        target_process_handle.into_param().abi(),
        mem::transmute(target_handle.unwrap_or(::std::ptr::null_mut())),
        access_mask,
        attributes,
        options,
    );

    if status.0 < 0 {
        Err(windows::core::Error::from_win32())
    } else {
        Ok(())
    }
}

/// Declare this struct by self, because it is not present in the windows crate.
/// see https://www.geoffchappell.com/studies/windows/km/ntoskrnl/api/ex/sysinfo/handle.htm
const SystemHandleInformation: SYSTEM_INFORMATION_CLASS = SYSTEM_INFORMATION_CLASS(0x10);
const ObjectNameInformation: OBJECT_INFORMATION_CLASS = OBJECT_INFORMATION_CLASS(0x1);

/// Declare this struct by self, because it is not present in the windows crate.
/// see https://www.geoffchappell.com/studies/windows/km/ntoskrnl/api/ex/sysinfo/handle.htm
#[derive(Debug)]
#[repr(C)]
struct SYSTEM_HANDLE_INFORMATION {
    NumberOfHandles: usize,
    Handles: [SYSTEM_HANDLE_TABLE_ENTRY_INFO; 1],
}

impl SYSTEM_HANDLE_INFORMATION {
    fn handles(&self) -> &[SYSTEM_HANDLE_TABLE_ENTRY_INFO] {
        // just like we'd do in C: take the address of the first element.
        // note: this will blow up if `self.NumberOfHandles` is incorrect.
        unsafe { slice::from_raw_parts(&self.Handles[0], self.NumberOfHandles) }
    }
}

/// Declare this struct by self, because it is not present in the windows crate.
/// see https://www.geoffchappell.com/studies/windows/km/ntoskrnl/api/ex/sysinfo/handle_table_entry.htm
#[derive(Debug)]
#[repr(C)]
struct SYSTEM_HANDLE_TABLE_ENTRY_INFO {
    UniqueProcessId: c_ushort,
    CreatorBackTraceIndex: c_ushort,
    ObjectTypeIndex: c_uchar,
    HandleAttributes: c_uchar,
    HandleValue: c_ushort,
    Object: *mut c_void,
    GrantedAccess: c_ulong,
}

pub struct VLS<T> {
    buffer: Vec<u8>,
    _maker: PhantomData<T>,
}

impl<T> VLS<T> {
    pub fn new<F>(fun: F) -> windows::core::Result<Self>
    where
        F: Fn(*mut T, u32, *mut u32) -> windows::core::Result<()>,
    {
        let mut buffer: Vec<u8> = vec![];
        loop {
            let mut return_length = 0;
            let result = fun(
                buffer.as_mut_ptr().cast(),
                buffer.len() as u32,
                &mut return_length,
            );
            let return_length = return_length as usize;
            match result {
                Ok(()) => break,
                Err(_) if return_length > buffer.len() => {
                    buffer.clear();
                    buffer.reserve_exact(return_length);
                    buffer.resize(return_length, 0);
                }
                Err(e) => return Err(e),
            }
        }

        Ok(Self {
            buffer,
            _maker: PhantomData::default(),
        })
    }
}

impl<T> Deref for VLS<T> {
    type Target = T;

    fn deref(&self) -> &T {
        unsafe { mem::transmute(self.buffer.as_ptr()) }
    }
}

pub fn query_handles_by_pid(pid: u32) -> windows::core::Result<Vec<u16>> {
    let data: VLS<SYSTEM_HANDLE_INFORMATION> =
        VLS::new(|ptr: *mut SYSTEM_HANDLE_INFORMATION, len, size| unsafe {
            NtQuerySystemInformation(SystemHandleInformation, ptr.cast(), len, size)
        })?;
    let data = data
        .handles()
        .iter()
        .filter(|item| item.UniqueProcessId as u32 == pid)
        .map(|item| item.HandleValue)
        .collect();
    Ok(data)
}

pub fn query_object(target_handle: HANDLE, info_class: OBJECT_INFORMATION_CLASS) -> Option<String> {
    let result = VLS::new(|ptr: *mut OBJECT_NAME_INFORMATION, len, size| unsafe {
        NtQueryObject(target_handle, info_class, Some(ptr.cast()), len, Some(size))
    });

    match result {
        Ok(info) if info.buffer.len() > size_of::<OBJECT_NAME_INFORMATION>() => {
            match unsafe { info.Name.Buffer.to_string() } {
                Ok(name) => Some(name),
                _ => None,
            }
        }
        _ => None,
    }
}

pub fn clone_handle(
    source_process_handle: HANDLE,
    source_handle: HANDLE,
    target_process_handle: HANDLE,
) -> windows::core::Result<HANDLE> {
    let mut target_handle: MaybeUninit<HANDLE> = MaybeUninit::uninit();

    unsafe {
        match _NtDuplicateObject(
            source_process_handle,
            source_handle,
            target_process_handle,
            Some(target_handle.as_mut_ptr().cast()),
            0,
            0,
            0,
        ) {
            Ok(_) => Ok(target_handle.assume_init()),
            Err(e) => Err(e),
        }
    }
}

macro_rules! unwrap_or_continue {
    ($var:ident) => {
        if $var.is_err() {
            continue;
        }
        let $var = $var.unwrap();
    };
}

macro_rules! unwrap_or_return_error {
    ($var:ident, $error:expr) => {
        if $var.is_err() {
            return Err($error);
        }
        let $var = $var.unwrap();
    };
}

macro_rules! timeout {
    ($millis:expr, $func:expr) => {{
        tokio::time::timeout(
            std::time::Duration::from_millis($millis),
            tokio::task::spawn_blocking($func),
        )
        .await
    }};
}

/// Find the process that is handling the file.
pub async fn find_process_handling_file(
    path: &str,
    event: &Channel<WatchProcessEvent>,
) -> Result<Pid, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cores = thread::available_parallelism().unwrap();
    let cores = cores.get();
    let semaphore = Arc::new(Semaphore::new(cores));

    info!("Listing open handles for all processes");
    debug!("Number of cores: {}", cores);
    debug!("Number of processes: {}", sys.processes().len());

    let target_process_handle = unsafe { GetCurrentProcess() };
    let path = Arc::new(path.to_string());

    let processes = sys
        .processes()
        .iter()
        .map(|(pid, _)| pid.clone())
        .collect::<Vec<Pid>>();

    event
        .send(WatchProcessEvent::SearchingNativeProcess {
            processes: Some(processes.len() as u32),
        })
        .map_err(|e| e.to_string())?;
    let async_event = Arc::new(event);

    // profile the function at runtime
    let now = SystemTime::now();

    // iterate over all processes with at most `cores` tasks running concurrently, this grants
    // that we are not going to spawn more tasks than the number of cores available improving
    // performances.
    let tasks = stream::iter(processes.into_iter())
        .map(|pid| {
            let semaphore = semaphore.clone();
            let handle = target_process_handle.clone();
            let path = path.clone();
            let event = async_event.clone();

            async move {
                // skip the system and the current processes
                if pid.as_u32() == 0 || pid.as_u32() == handle.0 as u32 {
                    event
                        .send(WatchProcessEvent::ProcessAnalyzed)
                        .map_err(|e| e.to_string())?;
                    return Err("Skipping system and current process".to_string());
                }

                let _permit = semaphore.acquire().await;
                let result = analyze_process_handles(pid.as_u32(), handle, path).await;
                event
                    .send(WatchProcessEvent::ProcessAnalyzed)
                    .map_err(|e| e.to_string())?;

                result
            }
        })
        .buffer_unordered(cores);

    let results = tasks.collect::<Vec<Result<u32, String>>>().await;
    let duration = now.elapsed().unwrap_or_default();
    info!(
        "Processes traversed in {:.2} seconds",
        duration.as_secs_f64()
    );

    // find the first process that has the file open
    let pid = results.iter().find_map(|r| match r {
        Ok(pid) => Some(*pid),
        Err(_) => None,
    });

    if let Some(pid) = pid {
        event
            .send(WatchProcessEvent::ProcessFound)
            .map_err(|e| e.to_string())?;
        Ok(Pid::from_u32(pid))
    } else {
        event
            .send(WatchProcessEvent::ProcessNotFound)
            .map_err(|e| e.to_string())?;
        Err("No process found".to_string())
    }
}

/// Analyze the process handles to find the process that is handling the file.
///
/// # Arguments
///
/// * `pid` - The process id
/// * `target_process_handle` - The target process handle aka the current process handle
/// * `path` - The path of the file to find
///
/// # Returns
///
/// The process id that is handling the file
async fn analyze_process_handles(
    pid: u32,
    target_process_handle: HANDLE,
    path: Arc<String>,
) -> Result<u32, String> {
    let path = path.as_str().replace("C:\\", "");

    let handles = query_handles_by_pid(pid);
    unwrap_or_return_error!(handles, format!("Cannot query handles for pid {}", pid));

    // open the process with the required permissions
    let source_process_handle = unsafe { OpenProcess(PROCESS_DUP_HANDLE, BOOL(0), pid) };
    unwrap_or_return_error!(
        source_process_handle,
        format!("Cannot open process {}", pid)
    );

    for handle in &handles {
        let source_handle = HANDLE(*handle as isize);

        // trying to clone the handle for at most 250 milliseconds, if for some reason the handle
        // cannot be cloned withing the given time frame we are going to skip it.
        let target_handle = timeout!(250, move || clone_handle(
            source_process_handle,
            source_handle,
            target_process_handle
        ));
        unwrap_or_continue!(target_handle);
        unwrap_or_continue!(target_handle);
        unwrap_or_continue!(target_handle);

        // query the object type, again if the object type cannot be queried within the given time frame we are going to skip
        // the handle.
        let object_type = timeout!(250, move || query_object(
            target_handle,
            ObjectTypeInformation
        ));
        unwrap_or_continue!(object_type);
        unwrap_or_continue!(object_type);

        // if the object type is a file, we are going to query the name of the object
        if let Some(r#type) = object_type
            && &r#type == "File"
        {
            // query the name of the object, again if the name cannot be queried within the given time frame we are going to skip
            // the handle.
            let name = timeout!(250, move || query_object(
                target_handle,
                ObjectNameInformation
            ));
            unwrap_or_continue!(name);
            unwrap_or_continue!(name);

            trace!(
                "Process {} has a handle to '{}', path is '{}'",
                pid,
                name.as_ref().unwrap_or(&"<empty>".to_owned()),
                path.clone()
            );

            // if the name of the object ENDS WITH the filename we are looking for, we've found the process
            // that is handling the file.
            if let Some(name) = name
                && name.ends_with(path.as_str())
            {
                let _ = unsafe { CloseHandle(target_handle) };
                let _ = unsafe { CloseHandle(source_process_handle) };
                return Ok(pid);
            }
        }

        let _ = unsafe { CloseHandle(target_handle) };
    }

    let _ = unsafe { CloseHandle(source_process_handle) };

    Err("No process found".to_string())
}
