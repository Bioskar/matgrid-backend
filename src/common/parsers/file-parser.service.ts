import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';

@Injectable()
export class FileParserService {
  async parseFile(filePath: string): Promise<any[]> {
    const ext = filePath.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcel(filePath);
    } else if (ext === 'pdf') {
      return this.parsePDF(filePath);
    } else if (ext === 'csv') {
      return this.parseCSV(filePath);
    } else {
      throw new BadRequestException('Unsupported file format. Use Excel, PDF, or CSV');
    }
  }

  private parseExcel(filePath: string): any[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return data.map((row: any) => ({
      name: row.name || row.Name || row.Material || 'Unknown',
      quantity: row.quantity || row.Quantity || 1,
      unit: row.unit || row.Unit || 'pcs',
      specification: row.specification || row.Specification || '',
      category: row.category || row.Category || '',
      brand: row.brand || row.Brand || '',
    }));
  }

  private async parsePDF(filePath: string): Promise<any[]> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    // Extract text and parse materials
    const text = data.text;
    return this.extractMaterialsFromText(text);
  }

  private parseCSV(filePath: string): any[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const materials = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      const values = lines[i].split(',').map((v) => v.trim());
      const material: any = {};

      headers.forEach((header, index) => {
        material[header] = values[index] || '';
      });

      materials.push({
        name: material.name || material.material || 'Unknown',
        quantity: parseInt(material.quantity) || 1,
        unit: material.unit || 'pcs',
        specification: material.specification || '',
        category: material.category || '',
        brand: material.brand || '',
      });
    }

    return materials;
  }

  private extractMaterialsFromText(text: string): any[] {
    const materials = [];
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    // Simple extraction - can be enhanced with NLP
    lines.forEach((line) => {
      const cleanedLine = line.trim();
      if (cleanedLine.length > 0 && !cleanedLine.match(/^[0-9\s\-]+$/)) {
        materials.push({
          name: cleanedLine,
          quantity: 1,
          unit: 'pcs',
        });
      }
    });

    return materials;
  }
}
