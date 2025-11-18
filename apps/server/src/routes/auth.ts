import type { Request, Response } from 'express';
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: '邮箱与密码必填' });
  }

  try {
    // 示例：模拟查询用户，可替换为真正的 users 表
    const { rows } = await pool.query<{ email: string }>(
      'SELECT $1::text AS email',
      [email]
    );

    if (!rows.length || password !== 'secret') {
      return res.status(401).json({ message: '账号或密码错误（演示环境：密码为 secret）' });
    }

    const tokenPayload = Buffer.from(`${email}:${Date.now()}`).toString('base64');

    return res.json({
      token: tokenPayload,
      user: { email: rows[0].email }
    });
  } catch (error) {
    console.error('登录失败', error);
    return res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
