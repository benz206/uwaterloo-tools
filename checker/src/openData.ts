import axios, { AxiosInstance } from "axios";

class Client {
    private static base: string = "https://openapi.data.uwaterloo.ca/v3";

    private email: string;
    private project: string;
    private uri: string;
    private axiosClient: AxiosInstance;

    constructor(
        email: string,
        project: string,
        uri: string,
        timeout: number = 5000
    ) {
        this.email = email;
        this.project = project;
        this.uri = uri;
        this.axiosClient = axios.create({
            baseURL: Client.base,
            timeout: timeout,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
    }

    async register() {
        const response = await this.axiosClient.post("/Account/Register", null, {
            params: {
                email: encodeURIComponent(this.email),
                project: encodeURIComponent(this.project),  
                uri: encodeURIComponent(this.uri),
            },
        });
        return response.data;
    }

    async checkRegistration() {
        const response = await this.axiosClient.get(`/Account/${this.email}`);
        // 404 seems to be unconfirmed or not registered
        return response.data;
    }

    async confirmRegistration() {
        const response = await this.axiosClient.post("/Account/Confirm", null, {
            params: {
                
            }
        });
        return response.data
    }

    async getData() {}
}

export default Client;
