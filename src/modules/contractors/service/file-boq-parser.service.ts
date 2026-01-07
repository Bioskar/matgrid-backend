import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Logger } from 'pino';
import * as XLSX from 'xlsx';
import { ParsedMaterialItem } from '../dto/boq-parse.dto';
import { BOQParserService } from './boq-parser.service';

@Injectable()
export class FileBOQParserService {
  constructor(
    @Inject('PINO_LOGGER') private readonly logger: Logger,
    private readonly boqParserService: BOQParserService,
  ) {}

  async parseExcelFile(fileBuffer: Buffer, filename: string): Promise<ParsedMaterialItem[]> {
    this.logger.info({ filename }, '[FileBOQParser] Starting Excel file parsing');

    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      this.logger.info({ rows: data.length }, '[FileBOQParser] Excel rows extracted');

      return this.extractMaterialsFromRows(data);
    } catch (error) {
      this.logger.error({ error: error.message, filename }, '[FileBOQParser] Failed to parse Excel file');
      throw new BadRequestException('Failed to parse Excel file. Please ensure it is a valid Excel format.');
    }
  }

  private extractMaterialsFromRows(rows: any[][]): ParsedMaterialItem[] {
    const materials: ParsedMaterialItem[] = [];

    // Skip header row (first row)
    const dataRows = rows.slice(1).filter(row => row && row.length > 0);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      try {
        const material = this.parseRow(row, i + 2); // +2 because Excel is 1-indexed and we skipped header
        if (material) {
          materials.push(material);
        }
      } catch (error) {
        this.logger.warn({ row: i + 2, error: error.message }, '[FileBOQParser] Failed to parse row');
      }
    }

    this.logger.info({ materialsCount: materials.length }, '[FileBOQParser] Materials extracted from Excel');

    return materials;
  }

  private parseRow(row: any[], rowIndex: number): ParsedMaterialItem | null {
    // Try different column patterns
    // Pattern 1: [Item, Name, Quantity, Unit]
    // Pattern 2: [S/N, Description, Qty, Unit]
    // Pattern 3: [Name, Quantity, Unit]

    let name: string = '';
    let quantity: number = 0;
    let unit: string = '';
    let confidence = 0.8;

    // Filter out empty cells
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '');

    if (nonEmptyCells.length < 2) {
      return null; // Not enough data
    }

    // Try to identify columns
    if (row.length >= 4) {
      // Pattern 1 or 2: Has 4+ columns
      // Usually: [Index/S/N, Name/Description, Quantity, Unit]
      const potentialName = String(row[1] || row[0]).trim();
      const potentialQty = row[2] || row[1];
      const potentialUnit = String(row[3] || row[2] || '').trim();

      if (potentialName) {
        name = potentialName;
        quantity = this.extractNumber(potentialQty);
        unit = potentialUnit || this.guessUnit(potentialName);
        confidence = 0.85;
      }
    } else if (row.length === 3) {
      // Pattern 3: [Name, Quantity, Unit]
      name = String(row[0]).trim();
      quantity = this.extractNumber(row[1]);
      unit = String(row[2] || '').trim() || this.guessUnit(name);
      confidence = 0.8;
    } else if (row.length === 2) {
      // Just name and quantity
      name = String(row[0]).trim();
      quantity = this.extractNumber(row[1]);
      unit = this.guessUnit(name);
      confidence = 0.7;
    }

    if (!name || quantity <= 0) {
      return null;
    }

    // Clean up the name
    name = this.cleanMaterialName(name);

    return {
      name,
      quantity,
      unit: unit || 'items',
      originalText: `Row ${rowIndex}: ${row.join(' | ')}`,
      confidence,
    };
  }

  private extractNumber(value: any): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      // Remove commas and extract number
      const cleaned = value.replace(/,/g, '');
      const match = cleaned.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return 0;
  }

  private guessUnit(materialName: string): string {
    const lowerName = materialName.toLowerCase();

    // Common patterns
    if (lowerName.includes('cement') || lowerName.includes('bag')) return 'bags';
    if (lowerName.includes('sand') || lowerName.includes('granite')) return 'tonnes';
    if (lowerName.includes('rod') || lowerName.includes('iron') || lowerName.includes('steel')) return 'lengths';
    if (lowerName.includes('block')) return 'pieces';
    if (lowerName.includes('pipe')) return 'lengths';
    if (lowerName.includes('paint')) return 'liters';
    if (lowerName.includes('nail') || lowerName.includes('wire')) return 'kg';
    if (lowerName.includes('timber') || lowerName.includes('wood')) return 'lengths';
    if (lowerName.includes('sheet') || lowerName.includes('roofing')) return 'sheets';

    return 'items';
  }

  private cleanMaterialName(name: string): string {
    // Remove common prefixes
    name = name.replace(/^(item\s*\d+\s*[:\-.]|s\/n\s*\d+\s*[:\-.]|\d+\s*[:\-.])/i, '').trim();
    
    // Remove excessive whitespace
    name = name.replace(/\s+/g, ' ');

    return name;
  }

  async parsePDFFile(fileBuffer: Buffer, filename: string): Promise<ParsedMaterialItem[]> {
    this.logger.info({ filename }, '[FileBOQParser] PDF parsing requested');

    // For now, return a message that PDF parsing will be implemented
    // We can use pdf-parse library later or integrate with AI
    throw new BadRequestException(
      'PDF parsing is not yet supported. Please use Excel (.xlsx, .xls) or paste text directly.',
    );
  }

  async parseFile(file: Express.Multer.File): Promise<ParsedMaterialItem[]> {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (!fileExtension) {
      throw new BadRequestException('File has no extension');
    }

    switch (fileExtension) {
      case 'xlsx':
      case 'xls':
        return this.parseExcelFile(file.buffer, file.originalname);
      
      case 'pdf':
        return this.parsePDFFile(file.buffer, file.originalname);
      
      default:
        throw new BadRequestException(
          'Unsupported file format. Please upload Excel (.xlsx, .xls) or PDF files.',
        );
    }
  }
}
