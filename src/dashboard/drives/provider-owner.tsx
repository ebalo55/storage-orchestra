import {useParams} from "react-router";

export default function DrivesProviderOwner() {
    const {provider, owner} = useParams();
    return (
        <>DrivesProviderOwner, provider: {provider}, owner: {owner}</>
    );
}