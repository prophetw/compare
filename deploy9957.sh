#!/bin/bash

# 配置变量
REMOTE_USER="root"
REMOTE_HOST="192.168.99.57"
REMOTE_PATH="/root/bim-engine/web/html/"
LOCAL_DIST="/home/dev/code/compare/apps/frontend/dist"
REMOTE_DIST="dist"
REMOTE_APP_DIR="compare"
REMOTE_LAST_DIR="compare-last"
CONFIG_FILE="config.js"

# 函数：显示错误信息并退出
function error_exit {
    echo "$1" 1>&2
    exit 1
}

# Step 1: 使用 scp 复制 dist 目录到远程服务器
echo "开始复制 $LOCAL_DIST 到 $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
scp -r $LOCAL_DIST $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH
if [ $? -ne 0 ]; then
    error_exit "SCP 复制失败，部署中断。"
fi
echo "SCP 复制完成。"

# Step 2: 通过 ssh 登录并执行部署命令
echo "通过 SSH 登录到远程服务器并执行部署命令。"
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    set -e  # 当任何命令失败时，立即退出

    cd $REMOTE_PATH

    # 删除旧的备份目录
    echo "删除旧的备份目录 $REMOTE_LAST_DIR"
    rm -rf $REMOTE_LAST_DIR
    if [ $? -ne 0 ]; then
        echo "删除旧的备份目录失败。" >&2
        exit 1
    fi

    # 备份当前的应用目录
    echo "备份当前的应用目录 $REMOTE_APP_DIR 到 $REMOTE_LAST_DIR"
    mv $REMOTE_APP_DIR $REMOTE_LAST_DIR
    if [ $? -ne 0 ]; then
        echo "备份当前应用目录失败。" >&2
        exit 1
    fi

    # 部署新的应用目录
    echo "部署新的应用目录，将 $REMOTE_DIST 重命名为 $REMOTE_APP_DIR"
    mv $REMOTE_DIST $REMOTE_APP_DIR
    if [ $? -ne 0 ]; then
        echo "部署新应用目录失败。" >&2
        exit 1
    fi

    echo "部署成功。"
EOF

if [ $? -ne 0 ]; then
    error_exit "通过 SSH 执行部署命令失败。"
fi

echo "部署脚本执行完毕。"
