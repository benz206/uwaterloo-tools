import axios from "axios";
import * as cheerio from "cheerio";
import * as xlsx from "xlsx";
import dotenv from "dotenv";

// Config with env local
dotenv.config({ path: ".env.local" });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseExams = (html: string, category: string) => {
    const $ = cheerio.load(html);
    const exams: { title: string; url: string; category: string }[] = [];

    $("article.list-article").each((_, element) => {
        const title = $(element).find("h2.entry-title").text().trim();
        const link = $(element).find("div.entry-content a").attr("href");
        if (title && link) {
            exams.push({ 
                title, 
                url: `https://exams.engsoc.uwaterloo.ca/${link}`,
                category
            });
        }
    });

    return exams;
};

const fetchPage = async (page: number, category: string) => {
    const baseUrl = "https://exams.engsoc.uwaterloo.ca/";
    let tag: string;
    
    switch(category) {
        case "Mathematics":
            tag = "mathematics";
            break;
        case "Math":
            tag = "math";
            break;
        default:
            tag = "electrical-and-computer";
    }

    const url = page === 0 
        ? `${baseUrl}?tag=${tag}`
        : `${baseUrl}?tag=${tag}&paged=${page}`;

    const response = await axios.get(url, {
        headers: {
            Cookie: process.env.COOKIES,
        },
    });

    // console.log(response.data);

    return response.data;
};

const processPages = async () => {
    const allExams: { title: string; url: string; category: string }[] = [];
    
    // Process ECE exams (0-80 pages)
    for (let page = 0; page <= 80; page++) {
    // for (let page = 0; page <= 1; page++) {
    console.log(`Fetching ECE page ${page}...`);
        const html = await fetchPage(page, "ECE");
        const exams = parseExams(html, "ECE");
        allExams.push(...exams);
        await delay(1000);
    }

    // Process Mathematics exams (0-20 pages)
    for (let page = 0; page <= 20; page++) {
    // for (let page = 0; page <= 1; page++) {
        console.log(`Fetching Mathematics page ${page}...`);
        const html = await fetchPage(page, "Mathematics");
        const exams = parseExams(html, "Mathematics");
        allExams.push(...exams);
        await delay(1000);
    }

    // Process Math exams (0-5 pages)
    for (let page = 0; page <= 5; page++) {
    // for (let page = 0; page <= 1; page++) {
        console.log(`Fetching Math page ${page}...`);
        const html = await fetchPage(page, "Math");
        const exams = parseExams(html, "Math");
        allExams.push(...exams);
        await delay(1000);
    }

    const worksheet = xlsx.utils.json_to_sheet(allExams);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Exams");

    xlsx.writeFile(workbook, "exams.xlsx");
    console.log("Exams saved to exams.xlsx");
};

processPages().catch(console.error);
