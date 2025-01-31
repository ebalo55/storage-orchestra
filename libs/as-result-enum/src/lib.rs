use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::parse::Parser;
use syn::punctuated::Punctuated;
use syn::{Attribute, Data, DeriveInput, Fields, Meta, Token, parse_macro_input};

#[proc_macro_derive(AsResultEnum, attributes(derive_extra))]
pub fn as_result_enum(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let struct_name = input.ident;
    let enum_name = format_ident!("{}Result", struct_name);

    let mut extra_derive = None;

    for attr in input.attrs.iter() {
        if attr.path().is_ident("derive_extra") {
            if let Ok(meta) = attr.meta.clone().try_into() {
                if let Meta::List(meta_list) = meta {
                    // Parse the tokens inside parentheses (MetaList in syn 2.x)
                    let nested = Punctuated::<Meta, Token![,]>::parse_terminated
                        .parse2(meta_list.tokens)
                        .ok();

                    if let Some(first_meta) =
                        nested.and_then(|mut list| list.pop().map(|p| p.into_value()))
                    {
                        if let Meta::Path(path) = first_meta {
                            extra_derive = Some(quote!(#path));
                        }
                    }
                }
            }
        }
    }

    let fields = match input.data {
        Data::Struct(data_struct) => match data_struct.fields {
            Fields::Named(named_fields) => named_fields.named,
            _ => panic!("AsResultEnum macro only supports structs with named fields."),
        },
        _ => panic!("AsResultEnum macro can only be used with structs."),
    };

    let variant_definitions = fields.iter().filter_map(|field| {
        let field_name = field.ident.as_ref().unwrap();
        let field_type = &field.ty;
        let field_attrs: Vec<Attribute> = field.attrs.clone();

        if field_attrs.iter().any(|attr| {
            attr.path().is_ident("serde")
                && attr.parse_args::<Meta>().ok().map_or(
                    false,
                    |meta| matches!(meta, Meta::Path(path) if path.is_ident("skip")),
                )
        }) {
            return None;
        }

        Some(quote! {
            #(#field_attrs)*
            #field_name(#field_type)
        })
    });

    let display_arms = fields.iter().filter_map(|field| {
        let field_name = field.ident.as_ref().unwrap();
        let field_name_str = field_name.to_string();

        if field.attrs.iter().any(|attr| {
            attr.path().is_ident("serde")
                && attr.parse_args::<Meta>().ok().map_or(
                    false,
                    |meta| matches!(meta, Meta::Path(path) if path.is_ident("skip")),
                )
        }) {
            return None;
        }

        Some(quote! {
            #enum_name::#field_name(_) => #field_name_str,
        })
    });

    let derive_macros = if let Some(extra) = extra_derive {
        quote! {
            #[derive(Debug, Clone, Serialize, Deserialize, #extra)]
        }
    } else {
        quote! {
            #[derive(Debug, Clone, Serialize, Deserialize)]
        }
    };

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

    TokenStream::from(expanded)
}

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
