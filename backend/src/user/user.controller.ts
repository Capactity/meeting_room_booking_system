import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { RegisterUserDto } from "./dto/register-user.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { userInfo } from "os";
import { RequireLogin, UserInfo } from "src/custom.decorator";
import { UserDetailVo } from "./vo/user-info.vo";
import { UpdateUserPasswordDto } from "./dto/update-user-password.dto";
import { RedisService } from "src/redis/redis.service";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("用户管理模块")
@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Inject(JwtService)
  private jwtService: JwtService;
  @Inject(ConfigService)
  private configService: ConfigService;

  @Inject(RedisService)
  private redisService: RedisService;

  @ApiBody({ type: RegisterUserDto })
  @ApiResponse({
    status: 200,
    description: "用户注册成功",
    type: String,
  })
  @ApiResponse({ status: 401, description: "用户名已存在", type: String })
  @Post("register")
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser);
  }

  // get请求获取验证码，通过传入邮件地址
  @Get("captcha")
  async getCaptcha(@Query("email") email: string) {
    return await this.userService.getCaptcha(email);
  }

  @Post("login")
  async userLogin(@Body() loginUser: LoginUserDto) {
    console.log(loginUser);
    const vo = await this.userService.login(loginUser, false);
    vo.accessToken = this.jwtService.sign(
      {
        userId: vo.userInfo.id,
        username: vo.userInfo.username,
        roles: vo.userInfo.roles,
        permissions: vo.userInfo.permissions,
      },
      {
        expiresIn:
          this.configService.get("jwt_access_token_expires_time") || "30m",
      }
    );

    vo.refreshToken = this.jwtService.sign(
      {
        userId: vo.userInfo.id,
      },
      {
        expiresIn:
          this.configService.get("jwt_refresh_token_expres_time") || "7d",
      }
    );
    return vo;
  }

  @Post("admin/login")
  async adminLogin(@Body() loginUser: LoginUserDto) {
    console.log(loginUser);
    return await this.userService.login(loginUser, true);
  }

  @Get("refresh-token")
  async refreshToken(@Query("refreshToken") refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, false);

      const access_token = this.jwtService.sign(
        {
          userId: user.id,
          username: user.username,
          roles: user.roles,
          permissions: user.permissions,
        },
        {
          expiresIn:
            this.configService.get("jwt_access_token_expires_time") || "30m",
        }
      );

      const refresh_token = this.jwtService.sign(
        {
          userId: user.id,
        },
        {
          expiresIn:
            this.configService.get("jwt_refresh_token_expres_time") || "7d",
        }
      );

      return {
        access_token,
        refresh_token,
      };
    } catch (e) {
      throw new UnauthorizedException("token 已失效，请重新登录");
    }
  }

  @Get("admin/refresh")
  async adminRefresh(@Query("refreshToken") refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, true);

      const access_token = this.jwtService.sign(
        {
          userId: user.id,
          username: user.username,
          roles: user.roles,
          permissions: user.permissions,
        },
        {
          expiresIn:
            this.configService.get("jwt_access_token_expires_time") || "30m",
        }
      );

      const refresh_token = this.jwtService.sign(
        {
          userId: user.id,
        },
        {
          expiresIn:
            this.configService.get("jwt_refresh_token_expres_time") || "7d",
        }
      );

      return {
        access_token,
        refresh_token,
      };
    } catch (e) {
      throw new UnauthorizedException("token 已失效，请重新登录");
    }
  }

  // 查询用户信息
  @Get("info")
  @RequireLogin() // 登录验证装饰器
  async info(@UserInfo("userId") userId: number) {
    const user = await this.userService.findUserDetailById(userId);
    const vo = new UserDetailVo();
    vo.id = user.id;
    vo.email = user.email;
    vo.username = user.username;
    vo.headPic = user.headPic;
    vo.phoneNumber = user.phoneNumber;
    vo.nickName = user.nickName;
    vo.createTime = user.createTime;
    vo.isFrozen = user.isFrozen;
    return vo;
  }

  // 修改密码
  @Post(["update_password", "admin/update_password"])
  @RequireLogin()
  async updatePassword(
    @UserInfo("userId") userId: number,
    @Body() passwordDto: UpdateUserPasswordDto
  ) {
    return await this.userService.updatePassword(userId, passwordDto);
  }

  // 发送邮件验证码
  @Get("update_password/captcha")
  async updatePasswordCaptcha(@Query("address") address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(
      `update_password_captcha_${address}`,
      code,
      10 * 60
    );
    return `你的更改密码验证码是 ${code}`;
  }

  @Get("init-data")
  async initData() {
    await this.userService.initData();
    return "done";
  }
}
