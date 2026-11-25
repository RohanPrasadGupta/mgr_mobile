import { Redirect } from "expo-router";

// Landing route for signed-out users (the session guard sends them to the (auth) group root).
export default function AuthIndex() { return <Redirect href="/login" />; }
