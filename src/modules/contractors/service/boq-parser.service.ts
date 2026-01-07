import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'pino';
import { ParseBOQDto, ParsedMaterialItem, ParseBOQResponseDto } from '../dto/boq-parse.dto';

interface MaterialPattern {
  name: string;
  aliases: string[];
  commonUnits: string[];
}

@Injectable()
export class BOQParserService {
  constructor(@Inject('PINO_LOGGER') private readonly logger: Logger) {}

  private materialDatabase: MaterialPattern[] = [
    {
      name: 'Cement',
      aliases: ['cement', 'dangote', 'lafarge', 'unicem', 'bua cement'],
      commonUnits: ['bags', 'bag', 'tonnes', 'tons'],
    },
    {
      name: 'Sharp Sand',
      aliases: ['sharp sand', 'river sand', 'fine sand', 'sand'],
      commonUnits: ['tonnes', 'tons', 'ton', 'tonne', 'cubic meters', 'm3', 'trips', 'loads'],
    },
    {
      name: 'Granite',
      aliases: ['granite', 'stone', 'aggregate', 'gravel'],
      commonUnits: ['tonnes', 'tons', 'ton', 'tonne', 'cubic meters', 'm3', 'trips', 'loads'],
    },
    {
      name: 'Reinforcement Steel',
      aliases: ['iron rod', 'rebar', 'reinforcement', 'steel rod', 'iron', 'y10', 'y12', 'y16', '10mm', '12mm', '16mm', '20mm', '25mm'],
      commonUnits: ['lengths', 'length', 'pieces', 'pcs', 'tonnes', 'tons'],
    },
    {
      name: 'Blocks',
      aliases: ['block', 'blocks', 'concrete block', 'sandcrete', '6 inch', '9 inch'],
      commonUnits: ['pieces', 'pcs', 'units'],
    },
    {
      name: 'PVC Pipes',
      aliases: ['pvc pipe', 'pvc', 'water pipe', 'pipe', 'plumbing pipe'],
      commonUnits: ['lengths', 'rolls', 'pieces', 'meters'],
    },
    {
      name: 'Roofing Sheets',
      aliases: ['roofing sheet', 'zinc', 'aluminum roofing', 'longspan', 'stone coated'],
      commonUnits: ['sheets', 'pieces', 'bundles'],
    },
    {
      name: 'Binding Wire',
      aliases: ['binding wire', 'wire', 'tie wire'],
      commonUnits: ['rolls', 'kg', 'kilograms'],
    },
    {
      name: 'Nails',
      aliases: ['nail', 'nails', 'wire nail'],
      commonUnits: ['kg', 'kilograms', 'cartons', 'boxes'],
    },
    {
      name: 'Paint',
      aliases: ['paint', 'emulsion', 'gloss', 'primer', 'undercoat'],
      commonUnits: ['liters', 'litres', 'gallons', 'buckets'],
    },
    {
      name: 'Timber',
      aliases: ['timber', 'wood', 'plank', '2x4', '2x6', '4x4'],
      commonUnits: ['lengths', 'pieces', 'cubic meters'],
    },
    {
      name: 'Plywood',
      aliases: ['plywood', 'marine ply', 'blockboard'],
      commonUnits: ['sheets', 'pieces'],
    },
  ];

  async parseBOQ(dto: ParseBOQDto): Promise<ParseBOQResponseDto> {
    this.logger.info({ projectId: dto.projectId }, '[BOQParser] Starting BOQ parsing');

    const lines = dto.boqText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const parsedMaterials: ParsedMaterialItem[] = [];
    const warnings: string[] = [];

    for (const line of lines) {
      try {
        const parsed = this.parseLine(line);
        if (parsed) {
          parsedMaterials.push(parsed);
        }
      } catch (error) {
        warnings.push(`Could not parse line: "${line}"`);
        this.logger.warn({ line, error: error.message }, '[BOQParser] Failed to parse line');
      }
    }

    if (parsedMaterials.length === 0) {
      warnings.push('No materials could be extracted from the text. Please check the format.');
    }

    this.logger.info(
      { itemsFound: parsedMaterials.length, warningsCount: warnings.length },
      '[BOQParser] Parsing completed',
    );

    return {
      itemsFound: parsedMaterials.length,
      materials: parsedMaterials,
      warnings,
    };
  }

  private parseLine(line: string): ParsedMaterialItem | null {
    // Remove common prefixes like "Item 1:", "1.", "•", etc.
    let cleanLine = line.replace(/^(item\s*\d+\s*[:\-.]|[\d]+\s*[:\-.]|\•|\-|\*)\s*/i, '').trim();

    // Extract quantity and unit using regex
    const quantityPatterns = [
      // Pattern: "500 Bags of Cement"
      /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(bags?|tonnes?|tons?|lengths?|pieces?|pcs|units?|rolls?|sheets?|kg|kilograms?|meters?|m3|cubic\s*meters?|liters?|litres?|gallons?|buckets?|cartons?|boxes?|trips?|loads?)\s+(?:of\s+)?(.+)/i,
      
      // Pattern: "Cement - 500 Bags"
      /(.+?)\s*[-:]\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(bags?|tonnes?|tons?|lengths?|pieces?|pcs|units?|rolls?|sheets?|kg|kilograms?|meters?|m3|cubic\s*meters?|liters?|litres?|gallons?|buckets?|cartons?|boxes?|trips?|loads?)/i,
      
      // Pattern: "Cement (500 Bags)"
      /(.+?)\s*\((\d+(?:,\d{3})*(?:\.\d+)?)\s*(bags?|tonnes?|tons?|lengths?|pieces?|pcs|units?|rolls?|sheets?|kg|kilograms?|meters?|m3|cubic\s*meters?|liters?|litres?|gallons?|buckets?|cartons?|boxes?|trips?|loads?)\)/i,
    ];

    let quantity: number = 0;
    let unit: string = '';
    let materialName: string = '';
    let confidence: number = 0.5;

    for (const pattern of quantityPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        if (pattern.source.startsWith('(\\d+')) {
          // First pattern: quantity comes first
          quantity = parseFloat(match[1].replace(/,/g, ''));
          unit = match[2].toLowerCase();
          materialName = match[3].trim();
        } else {
          // Other patterns: quantity comes after material name
          materialName = match[1].trim();
          quantity = parseFloat(match[2].replace(/,/g, ''));
          unit = match[3].toLowerCase();
        }
        confidence = 0.85;
        break;
      }
    }

    // If no pattern matched, try to identify material anyway
    if (!materialName) {
      const identifiedMaterial = this.identifyMaterial(cleanLine);
      if (identifiedMaterial) {
        materialName = identifiedMaterial.name;
        confidence = 0.6;
        // Try to extract any number as quantity
        const numMatch = cleanLine.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
        if (numMatch) {
          quantity = parseFloat(numMatch[1].replace(/,/g, ''));
          confidence = 0.7;
        }
      }
    }

    if (!materialName) {
      return null;
    }

    // Identify material type for better naming
    const identifiedMaterial = this.identifyMaterial(materialName);
    if (identifiedMaterial) {
      // Keep original name but with better formatting
      materialName = this.formatMaterialName(materialName, identifiedMaterial);
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    // Normalize unit
    unit = this.normalizeUnit(unit);

    return {
      name: materialName,
      quantity: quantity || 1,
      unit: unit || 'items',
      originalText: line,
      confidence,
    };
  }

  private identifyMaterial(text: string): MaterialPattern | null {
    const lowerText = text.toLowerCase();
    
    for (const material of this.materialDatabase) {
      for (const alias of material.aliases) {
        if (lowerText.includes(alias.toLowerCase())) {
          return material;
        }
      }
    }
    
    return null;
  }

  private formatMaterialName(rawName: string, identified: MaterialPattern): string {
    // Extract brand names and specifications
    const brandPattern = /(dangote|lafarge|unicem|bua|elephant|devoe|dulux|berger)/i;
    const sizePattern = /(\d+\s*(?:mm|inch|"|'|x\d+))/gi;
    
    const brands = rawName.match(brandPattern);
    const sizes = rawName.match(sizePattern);
    
    let formatted = identified.name;
    
    if (sizes && sizes.length > 0) {
      formatted += ` (${sizes.join(' ')})`;
    }
    
    if (brands && brands.length > 0) {
      formatted += ` - ${brands[0]}`;
    }
    
    return formatted;
  }

  private normalizeUnit(unit: string): string {
    const unitMap: { [key: string]: string } = {
      'bag': 'bags',
      'bags': 'bags',
      'ton': 'tonnes',
      'tons': 'tonnes',
      'tonne': 'tonnes',
      'tonnes': 'tonnes',
      'length': 'lengths',
      'lengths': 'lengths',
      'piece': 'pieces',
      'pieces': 'pieces',
      'pcs': 'pieces',
      'unit': 'units',
      'units': 'units',
      'roll': 'rolls',
      'rolls': 'rolls',
      'sheet': 'sheets',
      'sheets': 'sheets',
      'kg': 'kg',
      'kilogram': 'kg',
      'kilograms': 'kg',
      'meter': 'meters',
      'meters': 'meters',
      'm3': 'cubic meters',
      'cubic meter': 'cubic meters',
      'cubic meters': 'cubic meters',
      'liter': 'liters',
      'liters': 'liters',
      'litre': 'liters',
      'litres': 'liters',
      'gallon': 'gallons',
      'gallons': 'gallons',
      'bucket': 'buckets',
      'buckets': 'buckets',
      'carton': 'cartons',
      'cartons': 'cartons',
      'box': 'boxes',
      'boxes': 'boxes',
      'trip': 'trips',
      'trips': 'trips',
      'load': 'loads',
      'loads': 'loads',
    };

    return unitMap[unit.toLowerCase()] || unit;
  }
}
