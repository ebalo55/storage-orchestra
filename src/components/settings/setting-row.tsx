import {
    Group,
    GroupProps,
    Stack,
    Text,
} from "@mantine/core";
import {
    FC,
    MutableRefObject,
    ReactNode,
} from "react";
import classes from "../../assets/setting-row.module.css";

interface SettingRowProps {
    children: ReactNode;
    title: ReactNode;
    description: ReactNode;
    target: MutableRefObject<any>;
}

type ExtendedSettingRowProps = SettingRowProps & Pick<GroupProps, "align">

export const SettingRow: FC<ExtendedSettingRowProps> = ({children, description, title, target, ...group}) => (
    <Group grow {...group}>
        <Stack gap={ 0 } onClick={ () => target.current.focus() } className={ "cursor-pointer" }>
            <Text fw={ 600 }>
                { title }
            </Text>
            {
                typeof description === "string" ? (
                    <>
                        <Text size={"sm"} c={"dark.4"} darkHidden>
                            {description}
                        </Text>
                        <Text size={"sm"} c={"gray.6"} lightHidden>
                            {description}
                        </Text>
                    </>
                ) : (
                    <>
                        <Stack darkHidden gap={0} classNames={{root: classes.description}}>
                            {description}
                        </Stack>
                        <Stack lightHidden gap={0} classNames={{root: classes.description}}>
                            {description}
                        </Stack>
                    </>
                )
            }
        </Stack>
        { children }
    </Group>
);