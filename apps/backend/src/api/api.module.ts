import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Transfer } from '../db/models/Transfer';
import { Pool } from '../db/models/Pool';
import { Token } from '../db/models/Token';
import { TxController } from './controller/tx.controller';
import { TransferController } from './controller/transfer.controller';
import { TokenController } from './controller/token.controller';
import { WalletController } from './controller/wallet.controller';
import { AccountController } from './controller/account.controller';
import { ViewController } from './controller/view.controller';
import { WellKnownController } from './controller/well-known.controller';
import { TxService } from './service/tx.service';
import { TransferService } from './service/transfer.service';
import { TokenService } from './service/token.service';
import { WalletService } from './service/wallet.service';
import { AccountService } from './service/account.service';

@Module({
  imports: [MikroOrmModule.forFeature([Transfer, Pool, Token])],
  controllers: [TxController, TransferController, TokenController, WalletController, AccountController, ViewController, WellKnownController],
  providers: [TxService, TransferService, TokenService, WalletService, AccountService],
})
export class ApiModule {}
