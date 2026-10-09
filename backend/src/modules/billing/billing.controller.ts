import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { BillingService } from './billing.service';

type Actor = { sub: string; role: string; organizationId: string | null };
type Request = { user: Actor };

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class SubscriptionsController {
  constructor(private readonly billing: BillingService) {}
  @Get('plans') plans(@Req() req: Request) {
    return this.billing.plans(req.user.role === 'Admin');
  }
  @Get('status') status(
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.billing.status(req.user, organizationId);
  }
  @Post('select') select(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.select(req.user, body);
  }
  @Post(':organizationId/suspend') @Roles(UserRole.ADMIN) suspend(
    @Req() req: Request,
    @Param('organizationId', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.suspend(req.user, id, true, body.reason);
  }
  @Post(':organizationId/restore') @Roles(UserRole.ADMIN) restore(
    @Req() req: Request,
    @Param('organizationId', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.suspend(req.user, id, false, body.reason);
  }
}

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('history/:kind') history(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billing.history(req.user, kind, query);
  }
  @Get('me') me(@Req() req: Request) {
    return this.billing.status(req.user);
  }
  @Get('organization/:id') @Roles(UserRole.ADMIN) organization(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.status(req.user, id);
  }
  @Get('invoices/:id') invoice(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.invoice(req.user, id);
  }
  @Post('invoices/:id/proof')
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: {
        fileSize: Number(process.env.PAYMENT_PROOF_MAX_BYTES || 5242880),
      },
    }),
  )
  proofUpload(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile()
    file?: {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype: string;
    },
  ) {
    return this.billing.submit(req.user, id, body, file);
  }
  @Get('submissions/:id/proof') async proof(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const proof = await this.billing.proof(req.user, id);
    res.setHeader('Content-Type', proof.mime);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="payment-proof"',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(proof.data);
  }
  @Get('instructions') instructions(@Req() req: Request) {
    return this.billing.instructions(req.user);
  }
  @Get('admin/instructions') @Roles(UserRole.ADMIN) allInstructions(
    @Req() req: Request,
  ) {
    return this.billing.instructions(req.user, true);
  }
  @Post('admin/instructions') @Roles(UserRole.ADMIN) instruction(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.saveInstruction(req.user, body);
  }
  @Patch('admin/instructions/:id') @Roles(UserRole.ADMIN) editInstruction(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.saveInstruction(req.user, body, id);
  }
  @Get('admin/reviews') @Roles(UserRole.ADMIN) reviews(
    @Req() req: Request,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billing.reviewQueue(req.user, query);
  }
  @Post('admin/reviews/:id') @Roles(UserRole.ADMIN) review(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.review(req.user, id, body);
  }
  @Get('admin/stats') @Roles(UserRole.ADMIN) stats(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.billing.adminStats(req.user, from, to);
  }
  @Get('admin/audit') @Roles(UserRole.ADMIN) audit(
    @Req() req: Request,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billing.auditList(req.user, query);
  }
  @Get('activity') activity(
    @Req() req: Request,
    @Query() query: Record<string, unknown>,
  ) {
    return this.billing.activityList(req.user, query);
  }
  @Get('admin/plans') @Roles(UserRole.ADMIN) plans() {
    return this.billing.plans(true);
  }
  @Post('admin/plans') @Roles(UserRole.ADMIN) createPlan(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.savePlan(req.user, body);
  }
  @Patch('admin/plans/:id') @Roles(UserRole.ADMIN) editPlan(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billing.savePlan(req.user, body, id);
  }
}
