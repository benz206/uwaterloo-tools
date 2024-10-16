import axios from "axios";
import * as cheerio from "cheerio";
import * as xlsx from "xlsx";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseExams = (html: string) => {
    const $ = cheerio.load(html);
    const exams: { title: string; url: string }[] = [];

    $("article.list-article").each((_, element) => {
        const title = $(element).find("h2.entry-title").text().trim();
        const link = $(element).find("div.entry-content a").attr("href");
        if (title && link) {
            exams.push({ title, url: `https://exams.engsoc.uwaterloo.ca/?tag=electrical-and-computer/${link}` });
        }
    });

    return exams;
};

const fetchPage = async (page: number) => {
    const url =
        page === 0
            ? `https://exams.engsoc.uwaterloo.ca/?tag=electrical-and-computer`
            : `https://exams.engsoc.uwaterloo.ca/?tag=electrical-and-computer&paged=${page}`;

    const response = await axios.get(url, {
        headers: {
            Cookie: process.env.COOKIES,
        },
    });

    return response.data;
};

const processPages = async () => {
    const allExams: { title: string; url: string }[] = [];
    //78
    for (let page = 0; page <= 78; page++) {
        console.log(`Fetching page ${page}...`);
        const html = await fetchPage(page);
        const exams = parseExams(html);
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
