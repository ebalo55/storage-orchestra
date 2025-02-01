import {
    Button,
    Card,
    Center,
    Image,
    PasswordInput,
    Stack,
    Text,
    Title,
} from "@mantine/core";
import {
    useForm,
    UseFormReturnType,
} from "@mantine/form";
import {yupResolver} from "mantine-form-yup-resolver";
import {useEffect} from "react";
import {
    NavigateFunction,
    useNavigate,
} from "react-router";
import * as yup from "yup";
import {commands} from "./tauri-bindings.ts";
import {ensureIsAuthenticated} from "./utility/ensure-is-autenticated.ts";

type LoginValues = {
    password: string;
}

type LoginForm = UseFormReturnType<LoginValues, (values: LoginValues) => LoginValues>;

async function login(values: LoginValues, form: LoginForm, navigate: NavigateFunction) {
    const result = await commands.initState(values.password);

    if (result.status === "error") {
        form.setErrors({
            password: result.error
        });
        return;
    }

    navigate("/dashboard");
}

export default function Login() {
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
        ensureIsAuthenticated(navigate);
    }, []);

    return (
        <Center h={ "100svh" } className={ "bg-indigo-200" }>
            <Card shadow={ "xs" } padding={ "xl" } className={ "bg-white" } miw={ "32rem" } maw={ "32rem" }>
                <form onSubmit={ login_form.onSubmit((values) => login(values, login_form, navigate)) }>
                    <Stack>
                        <Image src={ "/logo.svg" } alt={ "Storage Orchestra" } mah={ "4rem" } fit={ "contain" }/>
                        <div>
                            <Title className={ "text-center" }>Login</Title>
                            <Text className={ "text-center !font-semibold" } c={"dark.4"}>Sign in to your account</Text>
                        </div>
                        <PasswordInput placeholder={ "Password" } {...login_form.getInputProps("password")}/>
                        <Button onClick={ () => navigate("/dashboard") } fullWidth>Sign in</Button>
                    </Stack>
                </form>
            </Card>
        </Center>
    );
}

