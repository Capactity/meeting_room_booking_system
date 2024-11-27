import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser);
  }

  // get请求获取验证码，通过传入邮件地址
  @Get('captcha')
  async getCaptcha(@Query('email') email: string) {
    return await this.userService.getCaptcha(email);
  }
}
