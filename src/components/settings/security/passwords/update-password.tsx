import { Button, PasswordInput, Progress, Stack, Text, Title } from "@mantine/core";
import { useForm, UseFormReturnType } from "@mantine/form";
import { modals } from "@mantine/modals";
import { Channel } from "@tauri-apps/api/core";
import { yupResolver } from "mantine-form-yup-resolver";
import { Dispatch, FC, SetStateAction, useRef, useState } from "react";
import * as yup from "yup";
import { commands, PasswordUpdateEvent } from "../../../../tauri-bindings.ts";
import { SettingRow } from "../../setting-row.tsx";

type FormValues = {
    current_password: string
    new_password: string
    confirm_password: string
}
type UpdatePasswordForm = UseFormReturnType<FormValues, (values: FormValues) => FormValues>

async function handleSubmit(
    values: FormValues,
    setIsUpdatingPassword: Dispatch<SetStateAction<boolean>>,
    form: UpdatePasswordForm,
) {
    setIsUpdatingPassword(true);
    console.log("Updating password");

    const modal = modals.open({
        title:               <Title order={ 3 }>Updating password</Title>,
        withCloseButton:     false,
        closeOnClickOutside: false,
        children:            (
                                 <Stack p={ "lg" }>
                                     <Text>
                                         Password update in progress, please wait until the process is completed.
                                     </Text>
                                     <Stack gap={ 0 }>
                                         <Progress value={ 0 } animated/>
                                         <Text size={ "xs" } c={ "dimmed" } ml={ "auto" }>
                                             0.00% completed
                                         </Text>
                                     </Stack>
                                 </Stack>
                             ),
    });

    let steps = 0;
    let completed_steps = 0;

    const channel = new Channel<PasswordUpdateEvent>();
    channel.onmessage = (event) => {
        if (event.event === "completed") {
            setIsUpdatingPassword(false);
            form.reset();

            modals.updateModal({
                modalId:  modal,
                children: (
                              <Stack gap={ 0 } p={ "lg" }>
                                  <Text>
                                      Password update completed successfully.
                                  </Text>
                                  <Text>
                                      This modal will close automatically in 5 seconds.
                                  </Text>
                              </Stack>
                          ),
            });

            setTimeout(() => {
                modals.close(modal);
            }, 5000);
        }
        else if (event.event === "step_completed") {
            completed_steps++;

            const percent = (
                                completed_steps / steps
                            ) * 100;
            modals.updateModal({
                modalId:  modal,
                children: (
                              <Stack p={ "lg" }>
                                  <Text>
                                      Password update in progress, please wait until the process is completed.
                                  </Text>
                                  <Stack gap={ 0 }>
                                      <Progress value={ percent } animated/>
                                      <Text size={ "xs" } c={ "dimmed" } ml={ "auto" }>
                                          { percent.toFixed(2) }% completed
                                      </Text>
                                  </Stack>
                              </Stack>
                          ),
            });
        }
        else {
            steps = event.data.steps;
        }
    };

    const response = await commands.updatePassword(values.current_password, values.new_password, channel);
    if (response.status === "error") {
        console.error(response.error);
        setIsUpdatingPassword(false);
        form.reset();
    }
}

export const UpdatePassword: FC = () => {
    const ref = useRef(null);

    const [is_updating_password, setIsUpdatingPassword] = useState(false);
    const update_password_form = useForm({
        initialValues: {
            current_password: "",
            new_password:     "",
            confirm_password: "",
        },
        validate:      yupResolver(yup.object({
            current_password: yup.string().required("Current password is required"),
            new_password:     yup.string().min(8).required("New password is required"),
            confirm_password: yup.string()
                              .required("Confirm password is required")
                              .oneOf([yup.ref("new_password")], "Passwords do not match"),
        })),
    });

    return (
        <SettingRow title={"Update master password"}
                    description={<>
                        <Text>
                            Update the master password used to encrypt your data.
                        </Text>
                        <Text>
                            This will require some time to decrypt and re-encrypt all your data, please be patient.
                        </Text>
                    </>}
                    target={ref}
                    align={"self-start"}>
            <form onSubmit={update_password_form.onSubmit((values) => handleSubmit(
                values,
                setIsUpdatingPassword,
                update_password_form,
            ))}>
                <Stack w={"100%"}>
                    <PasswordInput
                        ref={ref}
                        placeholder={"Current master password"}
                        ml={"auto"}
                        maw={"24rem"}
                        miw={"24rem"}
                        {...update_password_form.getInputProps("current_password")}
                    />
                    <PasswordInput
                        placeholder={"New master password"}
                        ml={"auto"}
                        maw={"24rem"}
                        miw={"24rem"}
                        {...update_password_form.getInputProps("new_password")}
                    />
                    <PasswordInput
                        placeholder={"Confirm new master password"}
                        ml={"auto"}
                        maw={"24rem"}
                        miw={"24rem"}
                        {...update_password_form.getInputProps("confirm_password")}
                    />
                    <Button variant={"light"}
                            type={"submit"}
                            maw={"12rem"}
                            ml={"auto"}
                            loading={is_updating_password}>
                        Update password
                    </Button>
                </Stack>
            </form>
        </SettingRow>
    );
};