import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { RegisterUserDto } from "./dto/register-user.dto";
import { md5 } from "src/utils";
import { RedisService } from "src/redis/redis.service";
import { Role } from "./entities/role.entity";
import { permission } from "process";
import { Permission } from "./entities/permission.entity";
import { LoginUserDto } from "./dto/login-user.dto";
import { LoginUserVo } from "./vo/login-user.vo";
import { JwtService } from "@nestjs/jwt";
import { UpdateUserPasswordDto } from "./dto/update-user-password.dto";

@Injectable()
export class UserService {
  private logger = new Logger();
  @Inject(RedisService)
  private redisService: RedisService;

  @InjectRepository(User)
  private userRepository: Repository<User>;

  @InjectRepository(Role)
  private roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  async register(user: RegisterUserDto) {
    // 注册流程，查询redis中的验证码
    const captcha = await this.redisService.get(`captcha_${user.email}`);
    console.log("captcha", captcha);
    if (!captcha) {
      throw new HttpException("验证码已过期", HttpStatus.BAD_REQUEST);
    }
    if (user.captcha !== captcha) {
      throw new HttpException("验证码错误", HttpStatus.BAD_REQUEST);
    }
    // 查询数据库中是否存在该用户
    const foundUser = await this.userRepository.findOneBy({
      username: user.username,
    });
    if (foundUser) {
      throw new HttpException("用户已存在", HttpStatus.BAD_REQUEST);
    }
    // 创建用户
    const newUser = new User();
    newUser.username = user.username;
    newUser.password = md5(user.password);
    newUser.email = user.email;
    newUser.nickName = user.nickName;

    try {
      await this.userRepository.save(newUser);
      return { message: "注册成功" };
    } catch (error) {
      this.logger.error(error, UserService);
      return { message: "注册失败" };
    }
  }

  async getCaptcha(email: string) {
    const captcha = Math.random().toString().slice(2, 8);
    await this.redisService.set(`captcha_${email}`, captcha, 5 * 60);
    return { message: `你的验证码是 ${captcha}, 有效期5分钟` };
  }

  async login(loginUser: LoginUserDto, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        username: loginUser.username,
        isAdmin,
      },
      relations: ["roles", "roles.permissions"], // 级联查询
    });

    if (!user) {
      throw new HttpException("用户不存在", HttpStatus.BAD_REQUEST);
    }

    if (md5(loginUser.password) !== user.password) {
      throw new HttpException("密码错误", HttpStatus.BAD_REQUEST);
    }
    const vo = new LoginUserVo();
    vo.userInfo = {
      id: user.id,
      username: user.username,
      nickName: user.nickName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      headPic: user.headPic,
      createTime: user.createTime.getTime(),
      isFrozen: user.isFrozen,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };
    return vo;
  }

  async findUserById(userId: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isAdmin,
      },
      relations: ["roles", "roles.permissions"],
    });

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };
  }

  async findUserDetailById(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    return user;
  }

  //先查询 redis 中有相对应的验证码，检查通过之后根据 id 查询用户信息，修改密码之后 save。
  async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const captcha = await this.redisService.get(
      `update_password_captcha_${passwordDto.email}`
    );
    if (!captcha) {
      throw new HttpException("验证码已过期", HttpStatus.BAD_REQUEST);
    }
    if (captcha !== passwordDto.captcha) {
      throw new HttpException("验证码错误", HttpStatus.BAD_REQUEST);
    }
    const foundUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    foundUser.password = md5(passwordDto.password);

    try {
      await this.userRepository.save(foundUser);
      return "修改密码成功";
    } catch (e) {
      this.logger.error(e, UserService);
      return "修改密码失败";
    }
  }

  async initData() {
    const user1 = new User();
    user1.username = "zhangsan";
    user1.password = md5("111111");
    user1.email = "xxx@xx.com";
    user1.isAdmin = true;
    user1.nickName = "张三";
    user1.phoneNumber = "13233323333";

    const user2 = new User();
    user2.username = "lisi";
    user2.password = md5("222222");
    user2.email = "yy@yy.com";
    user2.nickName = "李四";

    const role1 = new Role();
    role1.name = "管理员";

    const role2 = new Role();
    role2.name = "普通用户";

    const permission1 = new Permission();
    permission1.code = "ccc";
    permission1.description = "访问 ccc 接口";

    const permission2 = new Permission();
    permission2.code = "ddd";
    permission2.description = "访问 ddd 接口";

    user1.roles = [role1];
    user2.roles = [role2];

    role1.permissions = [permission1, permission2];
    role2.permissions = [permission1];

    await this.permissionRepository.save([permission1, permission2]);
    await this.roleRepository.save([role1, role2]);
    await this.userRepository.save([user1, user2]);
  }
}
