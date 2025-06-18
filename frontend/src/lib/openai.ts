// src/lib/openai.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY || "",
});

export default openai;

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
