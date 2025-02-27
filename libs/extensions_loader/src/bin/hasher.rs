use extensions_loader::hash_file;
use std::env;

pub fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() != 2 {
        eprintln!("Usage: hasher <file>");
        return;
    }

    match hash_file(&args[1]) {
        Ok(hash) => println!("{}", hash),
        Err(e) => eprintln!("{}", e),
    }
}
