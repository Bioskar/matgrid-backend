import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from '../service/materials.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateQuoteDto } from '../../quotes/dto/create-quote.dto';
import { AddMaterialDto } from '../dto/add-material.dto';
import { PasteMaterialsDto } from '../dto/paste-materials.dto';
import { FileParserService } from '../../../common/parsers/file-parser.service';
import { diskStorage } from 'multer';
import * as path from 'path';

@ApiTags('Materials')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(
    private materialsService: MaterialsService,
    private fileParserService: FileParserService,
  ) {}

  @Post('quotes')
  async createQuote(@Req() req: any, @Body() createQuoteDto: CreateQuoteDto) {
    return this.materialsService.createQuote(req.user.userId, createQuoteDto);
  }

  @Get('quotes')
  async getUserQuotes(@Req() req: any) {
    return this.materialsService.getUserQuotes(req.user.userId);
  }

  @Get('quotes/:quoteId')
  async getQuote(@Req() req: any, @Param('quoteId') quoteId: string) {
    return this.materialsService.getQuote(quoteId, req.user.userId);
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
  async addMaterialManual(
    @Body() body: { quoteId: string; material: AddMaterialDto },
  ) {
    return this.materialsService.addMaterial(body.quoteId, body.material);
  }

  @Post('materials/paste')
  async pasteMaterials(
    @Body() body: { quoteId: string; materials: AddMaterialDto[] },
  ) {
    return this.materialsService.addMaterialsFromPaste(body.quoteId, body.materials);
  }

  @Post('materials/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || 'uploads/',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
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
