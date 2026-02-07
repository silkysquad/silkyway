import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ContentModule } from './content/content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // MikroOrmModule.forRoot({}),  // TODO: re-enable in Phase 2
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '.well-known'),
      serveRoot: '/.well-known',
    }),
    ContentModule,
  ],
  providers: [Logger],
})
export class AppModule {}
