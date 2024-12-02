import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FormatResponseInterceptor } from "./format-response.interceptor";
import { InvokeRecordInterceptor } from "./invoke-record.interceptor";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe()); // 全局启用接口校验
  app.useGlobalInterceptors(new FormatResponseInterceptor()); // 全局启用返回值格式拦截器
  app.useGlobalInterceptors(new InvokeRecordInterceptor()); // 全局启用接口调用记录拦截器

  const config = new DocumentBuilder()
    .setTitle("预定系统")
    .setDescription("api 接口文档")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);
  const configService = app.get(ConfigService); // 获取配置服务
  await app.listen(configService.get("nest_server_port"));
}
bootstrap();
