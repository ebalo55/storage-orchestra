import { Button } from "@mantine/core";
import { IconBrandGoogleDrive } from "@tabler/icons-react";
import { Dispatch, FC, SetStateAction, useState } from "react";
import { GoogleOAuth } from "../utility/google-auth.ts";

async function signIn(setAuthenticating: Dispatch<SetStateAction<boolean>>) {
    setAuthenticating(true);
    const googleOAuth = await GoogleOAuth.init();
    await googleOAuth.start();

    const interval = setInterval(() => {
        if (!googleOAuth.is_authenticating) {
            clearInterval(interval);
            setAuthenticating(false);
        }
    }, 2500);
}

export const GoogleDriveSignIn: FC = () => {
    const [ is_authenticating, setAuthenticating ] = useState(false);
    return (
        <Button leftSection={ <IconBrandGoogleDrive/> }
                onClick={ () => signIn(setAuthenticating) }
                loading={ is_authenticating }>
            Google Drive
        </Button>
    );
};