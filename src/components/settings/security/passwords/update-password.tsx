import {
    Button,
    PasswordInput,
    Skeleton,
    Stack,
    Text,
} from "@mantine/core";
import {
    useForm,
    UseFormReturnType,
} from "@mantine/form";
import {yupResolver} from "mantine-form-yup-resolver";
import {
    Dispatch,
    FC,
    SetStateAction,
    useRef,
    useState,
} from "react";
import * as yup from "yup";
import {SettingRow} from "../../setting-row.tsx";

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


    console.log("Password updated");
    setIsUpdatingPassword(false);
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
                    {
                        !settings && <Skeleton height={40}
                                               animate
                                               maw={"24rem"}
                                               ml={"auto"}/>
                    }
                    {
                        settings && (
                            <>
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
                            </>
                        )
                    }
                </Stack>
            </form>
        </SettingRow>
    );
};