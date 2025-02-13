extern crate proc_macro;

use proc_macro::TokenStream;
use quote::quote;
use syn::parse::{Parse, Parser};
use syn::{
    Attribute, Data, DeriveInput, Fields, GenericArgument, Meta, PathArguments, Type,
    parse_macro_input, parse_quote,
};

#[proc_macro_derive(AsInnerSerializable, attributes(serde))]
pub fn provider_data_derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let name = &input.ident;
    let inner_name = format!("{}Inner", name);
    let inner_name = syn::Ident::new(&inner_name, name.span());

    let fields = if let Data::Struct(data) = &input.data {
        if let Fields::Named(fields) = &data.fields {
            fields
                .named
                .iter()
                .map(|f| {
                    let field_attrs: Vec<Attribute> = f.attrs.clone();
                    if field_attrs.iter().any(|attr| {
                        attr.path.is_ident("serde") // Access `path` directly
                            && attr.parse_args::<Meta>().ok().map_or(
                            false,
                            |meta| matches!(meta, Meta::Path(path) if path.is_ident("skip")),
                        )
                    }) {
                        return None;
                    }

                    let field_name = &f.ident;
                    let field_type = &f.ty;
                    let stripped_type = strip_option_arc_rwlock(field_type);

                    Some(quote! {
                        #(#field_attrs)*
                        pub #field_name: #stripped_type
                    })
                })
                .filter_map(|f| f)
                .collect::<Vec<_>>()
        } else {
            panic!("ProviderDataDerive only supports structs with named fields");
        }
    } else {
        panic!("ProviderDataDerive only supports structs");
    };

    let field_names = if let Data::Struct(data) = &input.data {
        if let Fields::Named(fields) = &data.fields {
            fields.named.iter().map(|f| &f.ident).collect::<Vec<_>>()
        } else {
            panic!("ProviderDataDerive only supports structs with named fields");
        }
    } else {
        panic!("ProviderDataDerive only supports structs");
    };

    let into_inner_fields = if let Data::Struct(data) = &input.data {
        if let Fields::Named(fields) = &data.fields {
            fields
                .named
                .iter()
                .map(|f| {
                    let field_attrs: Vec<Attribute> = f.attrs.clone();
                    if field_attrs.iter().any(|attr| {
                        attr.path.is_ident("serde") // Access `path` directly
                            && attr.parse_args::<Meta>().ok().map_or(
                            false,
                            |meta| matches!(meta, Meta::Path(path) if path.is_ident("skip")),
                        )
                    }) {
                        return None;
                    }

                    let field_name = &f.ident;
                    let field_type = &f.ty;
                    if is_option_arc_rwlock(field_type) {
                        Some(quote! {
                            #field_name: if let Some(v) = self.#field_name.as_ref() {
                                    Some(v.read().await.clone())
                                } else {
                                    None
                                }
                        })
                    } else if is_arc_rwlock(field_type) {
                        Some(quote! {
                            #field_name: self.#field_name.read().await.clone()
                        })
                    } else {
                        Some(quote! {
                            #field_name: self.#field_name.clone()
                        })
                    }
                })
                .filter_map(|f| f)
                .collect::<Vec<_>>()
        } else {
            panic!("ProviderDataDerive only supports structs with named fields");
        }
    } else {
        panic!("ProviderDataDerive only supports structs");
    };

    let from_impl_fields = if let Data::Struct(data) = &input.data {
        if let Fields::Named(fields) = &data.fields {
            fields
                .named
                .iter()
                .map(|f| {
                    let field_name = &f.ident;
                    let field_type = &f.ty;

                    let field_attrs: Vec<Attribute> = f.attrs.clone();
                    if field_attrs.iter().any(|attr| {
                        attr.path.is_ident("serde") // Access `path` directly
                            && attr.parse_args::<Meta>().ok().map_or(
                            false,
                            |meta| matches!(meta, Meta::Path(path) if path.is_ident("skip")),
                        )
                    }) {
                        return Some(quote! {
                            #field_name: #field_type::default()
                        });
                    }

                    if is_option_arc_rwlock(field_type) {
                        Some(quote! {
                            #field_name: inner.#field_name.map(|v| Arc::new(RwLock::new(v)))
                        })
                    } else if is_arc_rwlock(field_type) {
                        Some(quote! {
                            #field_name: Arc::new(RwLock::new(inner.#field_name))
                        })
                    } else {
                        Some(quote! {
                            #field_name: inner.#field_name
                        })
                    }
                })
                .filter_map(|f| f)
                .collect::<Vec<_>>()
        } else {
            panic!("ProviderDataDerive only supports structs with named fields");
        }
    } else {
        panic!("ProviderDataDerive only supports structs");
    };

    let expanded = quote! {
        #[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
        pub struct #inner_name {
            #(#fields,)*
        }

        impl #name {
            pub async fn into_inner(&self) -> #inner_name {
                #inner_name {
                    #(#into_inner_fields,)*
                }
            }
        }

        impl From<#inner_name> for #name {
            fn from(inner: #inner_name) -> Self {
                Self {
                    #(#from_impl_fields,)*
                }
            }
        }

        impl Serialize for #name {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::ser::Serializer,
            {
                let data = tokio::task::block_in_place(|| {
                    tauri::async_runtime::block_on(async {
                        self.into_inner().await
                    })
                });
                data.serialize(serializer)
            }
        }

        impl<'de> Deserialize<'de> for #name {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::de::Deserializer<'de> {
                let inner = #inner_name::deserialize(deserializer)?;
                Ok(#name::from(inner))
            }
        }
    };

    TokenStream::from(expanded)
}

fn strip_option_arc_rwlock(ty: &Type) -> Type {
    if let Type::Path(type_path) = ty {
        if let Some(segment) = type_path.path.segments.last() {
            if segment.ident == "Arc" {
                if let PathArguments::AngleBracketed(args) = &segment.arguments {
                    if let Some(GenericArgument::Type(inner_type)) = args.args.first() {
                        return strip_option_arc_rwlock(inner_type);
                    }
                }
            } else if segment.ident == "RwLock" {
                if let PathArguments::AngleBracketed(args) = &segment.arguments {
                    if let Some(GenericArgument::Type(inner_type)) = args.args.first() {
                        return strip_option_arc_rwlock(inner_type);
                    }
                }
            }
            if segment.ident == "Option" {
                if let PathArguments::AngleBracketed(args) = &segment.arguments {
                    if let Some(GenericArgument::Type(inner_type)) = args.args.first() {
                        let inner_type = strip_option_arc_rwlock(inner_type);
                        return parse_quote!(Option<#inner_type>);
                    }
                }
            }
        }
    }
    ty.clone()
}

fn is_arc_rwlock(ty: &Type) -> bool {
    if let Type::Path(type_path) = ty {
        if let Some(segment) = type_path.path.segments.last() {
            if segment.ident == "Arc" {
                if let PathArguments::AngleBracketed(args) = &segment.arguments {
                    if let Some(GenericArgument::Type(inner_type)) = args.args.first() {
                        return is_rwlock(inner_type);
                    }
                }
            }
        }
    }
    false
}

fn is_rwlock(ty: &Type) -> bool {
    if let Type::Path(type_path) = ty {
        if let Some(segment) = type_path.path.segments.last() {
            if segment.ident == "RwLock" {
                return true;
            }
        }
    }
    false
}

fn is_option_arc_rwlock(ty: &Type) -> bool {
    if let Type::Path(type_path) = ty {
        if let Some(segment) = type_path.path.segments.last() {
            if segment.ident == "Option" {
                if let PathArguments::AngleBracketed(args) = &segment.arguments {
                    if let Some(GenericArgument::Type(inner_type)) = args.args.first() {
                        return is_arc_rwlock(inner_type);
                    }
                }
            }
        }
    }
    false
}
