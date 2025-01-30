use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::{parse_macro_input, DeriveInput, Data, Fields, Meta, Token};
use syn::parse::Parser;
use syn::punctuated::Punctuated;

/// Derive macro for generating an enum with struct field names as variants,
/// optionally accepting a `derive_extra` argument: `#[derive(KeysAsEnum)] #[derive_extra(Type)]`
#[proc_macro_derive(KeysAsEnum, attributes(derive_extra))]
pub fn keys_as_enum(input: TokenStream) -> TokenStream {
    // Parse the input tokens into a syntax tree
    let input = parse_macro_input!(input as DeriveInput);

    // Extract the name of the struct
    let struct_name = input.ident;

    // Generate the name for the enum by appending "Keys" to the struct name
    let enum_name = format_ident!("{}Keys", struct_name);

    let mut extra_derive = None;

    // Parse attributes for optional `derive_extra`
    for attr in input.attrs.iter() {
        if attr.path().is_ident("derive_extra") {
            if let Ok(meta) = attr.meta.clone().try_into() {
                if let Meta::List(meta_list) = meta {
                    // Parse the tokens inside parentheses (MetaList in syn 2.x)
                    let nested = Punctuated::<Meta, Token![,]>::parse_terminated
                        .parse2(meta_list.tokens)
                        .ok();

                    if let Some(first_meta) = nested.and_then(|mut list| list.pop().map(|p| p.into_value())) {
                        if let Meta::Path(path) = first_meta {
                            extra_derive = Some(quote!(#path));
                        }
                    }
                }
            }
        }
    }

    // Match on the data type to ensure it is a struct
    let fields = match input.data {
        Data::Struct(data_struct) => match data_struct.fields {
            Fields::Named(named_fields) => named_fields.named,
            _ => panic!("KeysAsEnum macro only supports structs with named fields."),
        },
        _ => panic!("KeysAsEnum macro can only be used with structs."),
    };

    // Generate enum variants from the struct fields
    let variant_definitions = fields.iter().map(|field| {
        let field_name = field.ident.as_ref().unwrap(); // Field name is guaranteed to be present in named fields
        let pascal_case_name = to_pascal_case(&field_name.to_string());
        let variant_name = format_ident!("{}", pascal_case_name);
        let field_name_str = field_name.to_string();
        quote! {
            #[serde(rename = #field_name_str)]
            #variant_name
        }
    });

    // Generate match arms for the Display implementation
    let display_arms = fields.iter().map(|field| {
        let field_name = field.ident.as_ref().unwrap();
        let pascal_case_name = to_pascal_case(&field_name.to_string());
        let variant_name = format_ident!("{}", pascal_case_name);
        let field_name_str = field_name.to_string();
        quote! {
            #enum_name::#variant_name => #field_name_str,
        }
    });

    // Build the final `#[derive(...)]` macro with optional extra derive
    let derive_macros = if let Some(extra) = extra_derive {
        quote! {
            #[derive(Debug, Clone, Serialize, Deserialize, #extra)]
        }
    } else {
        quote! {
            #[derive(Debug, Clone, Serialize, Deserialize)]
        }
    };

    // Generate the output token stream
    let expanded = quote! {
        #derive_macros
        pub enum #enum_name {
            #(#variant_definitions),*
        }

        impl std::fmt::Display for #enum_name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                let name = match self {
                    #(#display_arms)*
                };
                write!(f, "{}", name)
            }
        }
    };

    // Convert the expanded code into a TokenStream
    TokenStream::from(expanded)
}


/// Helper function to convert snake_case to PascalCase
fn to_pascal_case(s: &str) -> String {
    s.split('_')
     .map(|word| {
         let mut chars = word.chars();
         chars
             .next()
             .map(|c| c.to_uppercase().collect::<String>())
             .unwrap_or_default()
             + chars.as_str()
     })
     .collect::<Vec<String>>()
     .join("")
}