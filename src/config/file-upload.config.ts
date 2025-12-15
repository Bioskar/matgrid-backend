export const fileUploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB in bytes
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  allowedFileTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/pdf', 'text/csv'],
  allowedExtensions: ['.xlsx', '.xls', '.pdf', '.csv'],
};
