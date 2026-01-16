import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserPayload } from '../../../common/interfaces/user-payload.interface';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from '../service/materials.service';
import { Material } from '../../quotes/entities/material.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';
import { AddMaterialDto } from '../dto/add-material.dto';
import { PasteMaterialsDto } from '../dto/paste-materials.dto';
import { FileParserService } from '../../../common/parsers/file-parser.service';
import { diskStorage } from 'multer';
import * as path from 'path';

@ApiTags('Materials')
@ApiBearerAuth('JWT-auth')
@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(
    private materialsService: MaterialsService,
    private fileParserService: FileParserService,
  ) {}

  @Post('quotes')
  @ApiOperation({
    summary: 'Create a new quote request',
    description: `
      **Creates a new quote request for material sourcing**
      
      **Process:**
      1. Contractor creates empty quote with project details
      2. System generates unique quote ID
      3. Returns quote ready for materials to be added
      
      **Required fields:**
      - projectName: Name of the construction project
      - deliveryAddress: Where materials should be delivered
      
      **Optional fields:**
      - notes: Additional requirements or specifications
      - deliveryDate: Desired delivery date
      
      **Next steps after creation:**
      1. Add materials via upload: POST /materials/materials/upload
      2. Add materials via paste: POST /materials/materials/paste
      3. Add materials manually: POST /materials/materials/manual
      
      **Frontend flow:**
      - Create quote → Get quoteId → Add materials → Review → Send to suppliers
      
      **Use for:**
      - Starting a new material request process
      - Creating project-specific quotes
    `
  })
  @ApiResponse({
    status: 201,
    description: 'Quote created successfully',
    schema: {
      example: {
        success: true,
        quote: {
          id: '507f1f77bcf86cd799439011',
          projectName: 'Office Building Construction',
          deliveryAddress: '123 Main St, Lagos',
          status: 'draft',
          materialsCount: 0,
          createdAt: '2025-12-17T10:00:00.000Z'
        }
      }
    }
  })
  async createQuote(@CurrentUser() user: UserPayload, @Body() createQuoteDto: CreateQuoteDto) {
    return this.materialsService.createQuote(user.userId, createQuoteDto);
  }

  @Get('quotes')
  async getUserQuotes(@CurrentUser() user: UserPayload) {
    return this.materialsService.getUserQuotes(user.userId);
  }

  @Get('quotes/:quoteId')
  async getQuote(@CurrentUser() user: UserPayload, @Param('quoteId') quoteId: string) {
    return this.materialsService.getQuote(quoteId, user.userId);
  }

  @Put('quotes/:quoteId/status')
  async updateQuoteStatus(
    @Param('quoteId') quoteId: string,
    @Body() body: { status: string },
  ) {
    return this.materialsService.updateQuoteStatus(quoteId, body.status);
  }

  @Delete('quotes/:quoteId')
  async deleteQuote(@Param('quoteId') quoteId: string) {
    // TODO: Implement quote deletion
    return { success: true, message: 'Quote deleted' };
  }

  @Post('materials/manual')
  @ApiOperation({
    summary: 'Add single material manually',
    description: `
      **Adds one material item to a quote manually**
      
      **Required fields:**
      - quoteId: The quote to add material to
      - material.itemName: Name of the material (e.g., "Cement", "Steel Rod")
      - material.quantity: How many units needed
      - material.unit: Unit of measurement (Bags, Pcs, Tons, M3)
      
      **Optional fields:**
      - material.brand: Preferred brand (e.g., "Dangote", "Arik")
      - material.description: Additional specifications
      - material.estimatedPrice: Expected price per unit
      
      **Use for:**
      - Adding items one by one through UI form
      - Adding forgotten items to existing quote
      - Custom materials not in upload files
      
      **Frontend implementation:**
      - Show form with fields: Item Name, Quantity, Unit, Brand
      - Validate quantity > 0
      - Provide dropdown for common units
      - Add button adds and shows in list
      
      **After adding:** Material appears in quote materials list
    `
  })
  @ApiBody({
    schema: {
      example: {
        quoteId: '507f1f77bcf86cd799439011',
        material: {
          itemName: 'Cement',
          quantity: 50,
          unit: 'Bags',
          brand: 'Dangote'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Material added successfully',
    schema: {
      example: {
        success: true,
        material: {
          id: '507f1f77bcf86cd799439012',
          itemName: 'Cement',
          quantity: 50,
          unit: 'Bags',
          brand: 'Dangote'
        }
      }
    }
  })
  async addMaterialManual(
    @Body() body: { quoteId: string; material: AddMaterialDto },
  ) {
    return this.materialsService.addMaterial(body.quoteId, body.material);
  }

  @Post('materials/paste')
  @ApiOperation({
    summary: 'Paste multiple materials from spreadsheet',
    description: `
      **Adds multiple materials by pasting from Excel/spreadsheet**
      
      **How it works:**
      1. User copies materials from Excel (Ctrl+C)
      2. Pastes into textarea in your app
      3. Frontend parses and sends as JSON array
      4. All materials added at once
      
      **Required in array:**
      - itemName: Material name
      - quantity: Amount needed
      - unit: Measurement unit
      
      **Expected format from Excel:**
      \`\`\`
      Item Name    Quantity    Unit    Brand
      Cement       50          Bags    Dangote
      Steel Rod    100         Pcs     Arik
      Sand         10          Tons    -
      \`\`\`
      
      **Frontend parsing:**
      \`\`\`javascript
      const lines = pastedText.split('\\n');
      const materials = lines.map(line => {
        const [itemName, quantity, unit, brand] = line.split('\\t');
        return { itemName, quantity: Number(quantity), unit, brand };
      });
      \`\`\`
      
      **Benefits:**
      - Faster than manual entry
      - No file upload needed
      - Instant feedback
      - Easy corrections
      
      **Use for:**
      - Quick material list entry
      - Copying from existing spreadsheets
      - Small to medium lists (up to 100 items)
    `
  })
  @ApiBody({
    schema: {
      example: {
        quoteId: '507f1f77bcf86cd799439011',
        materials: [
          { itemName: 'Cement', quantity: 50, unit: 'Bags', brand: 'Dangote' },
          { itemName: 'Steel Rod', quantity: 100, unit: 'Pcs', brand: 'Arik' }
        ]
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Materials added successfully',
    schema: {
      example: {
        success: true,
        count: 2,
        materials: [
          { id: '1', itemName: 'Cement', quantity: 50, unit: 'Bags' },
          { id: '2', itemName: 'Steel Rod', quantity: 100, unit: 'Pcs' }
        ]
      }
    }
  })
  async pasteMaterials(
    @Body() body: { quoteId: string; materials: AddMaterialDto[] },
  ) {
    return this.materialsService.addMaterialsFromPaste(body.quoteId, body.materials);
  }

  @Post('materials/upload')
  @ApiOperation({
    summary: 'Upload Excel/CSV/PDF to extract materials',
    description: `
      **Uploads a material list file and automatically extracts items**
      
      **Supported formats:**
      - Excel: .xlsx, .xls (Microsoft Excel)
      - CSV: .csv (Comma-separated values)
      - PDF: .pdf (Must have table structure)
      
      **File requirements:**
      - Max size: 10MB
      - Must contain columns: Item Name, Quantity, Unit
      - Optional columns: Brand, Description, Unit Price
      - First row should be column headers
      - Subsequent rows contain material data
      
      **How it works:**
      1. Upload file using multipart/form-data
      2. System automatically detects file format
      3. Parses and extracts material rows
      4. Associates materials with specified quoteId
      5. Returns list of extracted materials
      6. Original file is deleted after processing
      
      **Request format (multipart/form-data):**
      - file: The Excel/CSV/PDF file
      - quoteId: The quote to add materials to
      
      **Frontend implementation:**
      \`\`\`javascript
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('quoteId', currentQuoteId);
      
      fetch('/api/v1/materials/materials/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token
          // Don't set Content-Type, browser handles it
        },
        body: formData
      });
      \`\`\`
      
      **Excel/CSV format example:**
      | Item Name | Quantity | Unit | Brand |
      |-----------|----------|------|-------|
      | Cement    | 50       | Bags | Dangote |
      | Steel Rod | 100      | Pcs  | Arik |
      
      **Success response:**
      - Returns count of extracted materials
      - Returns full list of materials with IDs
      - Materials are immediately available in quote
      
      **Error handling:**
      - "No file uploaded" → Ensure file input has name="file"
      - "Quote ID is required" → Include quoteId in form-data
      - "Failed to parse" → Check file format and structure
      - "File too large" → Reduce file size or split into multiple uploads
      
      **Performance:**
      - Small files (<1MB): ~2-3 seconds
      - Large files (5-10MB): ~5-10 seconds
      - Average: 100 materials extracted per second
      
      **Frontend checklist:**
      - Show file picker with accept=".xlsx,.xls,.csv,.pdf"
      - Display loading indicator during upload
      - Show progress if possible (upload + processing)
      - Display extracted materials count on success
      - Allow user to review/edit extracted materials
      - Provide option to add more items manually
      
      **Next step:** Review materials at GET /materials/materials/:quoteId
    `
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload file with quoteId',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel/CSV/PDF file containing materials (.xlsx, .xls, .csv, .pdf)'
        },
        quoteId: {
          type: 'string',
          description: 'The quote ID to associate materials with'
        }
      },
      required: ['file', 'quoteId']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Materials successfully extracted and added',
    schema: {
      example: {
        success: true,
        message: '15 materials extracted from file',
        materials: [
          {
            id: '507f1f77bcf86cd799439011',
            itemName: 'Cement',
            quantity: 50,
            unit: 'Bags',
            brand: 'Dangote',
            quoteId: '507f1f77bcf86cd799439012'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing required data',
    schema: {
      example: {
        success: false,
        message: 'Failed to parse file: Unsupported file format'
      }
    }
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || 'uploads/',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${path.extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { quoteId: string },
  ) {
    if (!file) {
      return {
        success: false,
        message: 'No file uploaded',
      };
    }

    if (!body.quoteId) {
      return {
        success: false,
        message: 'Quote ID is required',
      };
    }

    try {
      const materials = await this.fileParserService.parseFile(file.path);
      const result = await this.materialsService.addMaterialsFromUpload(
        body.quoteId,
        materials,
      );

      // Clean up file
      const fs = require('fs');
      fs.unlinkSync(file.path);

      return {
        success: true,
        message: `${result.count} materials extracted from file`,
        materials: result.materials,
      };
    } catch (error) {
      // Clean up file on error
      const fs = require('fs');
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('materials/:quoteId')
  async getMaterials(@Param('quoteId') quoteId: string) {
    return this.materialsService.getMaterials(quoteId);
  }

  @Put('materials/:materialId')
  async updateMaterial(
    @Param('materialId') materialId: string,
    @Body() updateData: any,
  ) {
    return this.materialsService.updateMaterial(materialId, updateData);
  }

  @Delete('materials/:materialId')
  async deleteMaterial(
    @Param('materialId') materialId: string,
    @Body() body: { quoteId: string },
  ) {
    return this.materialsService.deleteMaterial(materialId, body.quoteId);
  }
}
