import { Button, Card, Center, Image, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { useForm, UseFormReturnType } from "@mantine/form";
import { yupResolver } from "mantine-form-yup-resolver";
import { useEffect } from "react";
import { NavigateFunction, useNavigate } from "react-router";
import * as yup from "yup";
import { ThemeContextType, useThemeContext } from "./hooks/use-theme.tsx";
import { commands } from "./tauri-bindings.ts";
import { computeDefaultPage } from "./utility/compute-default-page.ts";
import { ensureIsAuthenticated } from "./utility/ensure-is-autenticated.ts";
import { loadTheme } from "./utility/load-theme.ts";
import { State } from "./utility/state.ts";

type LoginValues = {
    password: string;
}

type LoginForm = UseFormReturnType<LoginValues, (values: LoginValues) => LoginValues>;

async function login(values: LoginValues, form: LoginForm, navigate: NavigateFunction, theme_ctx: ThemeContextType) {
    try {
        await State.init(values.password);
        const settings = await commands.loadSettings();
        loadTheme(theme_ctx, settings);
        navigate(computeDefaultPage(settings));
    }
    catch (e) {
        if (e instanceof Error) {
            form.setErrors({
                password: e.message,
            });
        }
    }
}

export default function Login() {
    const theme_ctx = useThemeContext();
    const navigate = useNavigate();

    const login_form = useForm({
        initialValues: {
            password: ""
        },
        validate: yupResolver(yup.object({
            password: yup.string().required("Password is required")
        }))
    })

    useEffect(() => {
        ensureIsAuthenticated(navigate, theme_ctx);
    }, []);

    return (
        <Center h={ "100svh" } className={ "bg-indigo-200" }>
            <Card shadow={ "xs" } padding={ "xl" } className={ "bg-white" } miw={ "32rem" } maw={ "32rem" }>
                <form onSubmit={ login_form.onSubmit((values) => login(values, login_form, navigate, theme_ctx)) }>
                    <Stack>
                        <Image src={ "/logo.svg" } alt={ "Storage Orchestra" } mah={ "4rem" } fit={ "contain" }/>
                        <div>
                            <Title className={ "text-center" }>Login</Title>
                            <Text className={ "text-center !font-semibold" } c={"dark.4"}>Sign in to your account</Text>
                        </div>
                        <PasswordInput placeholder={ "Password" } {...login_form.getInputProps("password")}/>
                        <Button type={"submit"} fullWidth>Sign in</Button>
                    </Stack>
                </form>
            </Card>
        </Center>
    );
}

