import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe()); // 全局启用接口校验
  const configService = app.get(ConfigService); // 获取配置服务
  await app.listen(configService.get('nest_server_port'));
}
bootstrap();
