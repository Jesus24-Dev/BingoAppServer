import { promises as fs } from 'fs';
import path from 'path';
import { BingoNumber } from '../types/bingoNumberType';

// Ruta al archivo JSON
const jsonFilePath = path.resolve(__dirname, '../data/numbers.json');

// Leer el archivo JSON y guardarlo en una variable
export async function readJsonFile(): Promise<BingoNumber[]> {
  try {
    const data = await fs.readFile(jsonFilePath, 'utf-8');
    const jsonData: BingoNumber[] = JSON.parse(data);
    return jsonData;
  } catch (error) {
    console.error('Error al leer el archivo:', error);
    return [];
  }
}

export async function writeJsonFile(data: BingoNumber[]) {
  try {
    await fs.writeFile(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    throw new Error(`Error al escribir el archivo JSON: ${err}`);
  }
}


