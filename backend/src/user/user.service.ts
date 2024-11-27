import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterUserDto } from './dto/register-user.dto';
import { md5 } from 'src/utils';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class UserService {
  private logger = new Logger();
  @Inject(RedisService)
  private redisService: RedisService;

  @InjectRepository(User)
  private userRepository: Repository<User>;

  async register(user: RegisterUserDto) {
    // 注册流程，查询redis中的验证码
    const captcha = await this.redisService.get(`captcha_${user.email}`);
    console.log('captcha', captcha);
    if (!captcha) {
      throw new HttpException('验证码已过期', HttpStatus.BAD_REQUEST);
    }
    if (user.captcha !== captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }
    // 查询数据库中是否存在该用户
    const foundUser = await this.userRepository.findOneBy({
      username: user.username,
    });
    if (foundUser) {
      throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
    }
    // 创建用户
    const newUser = new User();
    newUser.username = user.username;
    newUser.password = md5(user.password);
    newUser.email = user.email;
    newUser.nickName = user.nickName;

    try {
      await this.userRepository.save(newUser);
      return { message: '注册成功' };
    } catch (error) {
      this.logger.error(error, UserService);
      return { message: '注册失败' };
    }
  }

  async getCaptcha(email: string) {
    const captcha = Math.random().toString().slice(2, 8);
    await this.redisService.set(`captcha_${email}`, captcha, 5 * 60);
    return { message: `你的验证码是 ${captcha}, 有效期5分钟` };
  }
}
