import Client from "./openData";

const client = new Client(
    "ben.zhou.2006@gmail.com",
    "Checker",
    "https://github.com/Leg3ndary/uwaterloo-tools",
);

client.checkRegistration().then((data) => {
    console.log(data);
});