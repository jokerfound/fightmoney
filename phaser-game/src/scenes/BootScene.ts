export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // 显示加载进度
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(240, 270, 320, 50);

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: '加载中...',
            style: {
                font: '20px monospace',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        const percentText = this.make.text({
            x: width / 2,
            y: height / 2 - 5,
            text: '0%',
            style: {
                font: '18px monospace',
                color: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);

        const assetText = this.make.text({
            x: width / 2,
            y: height / 2 + 50,
            text: '',
            style: {
                font: '18px monospace',
                color: '#ffffff'
            }
        });
        assetText.setOrigin(0.5, 0.5);

        // 更新进度条
        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff00, 1);
            progressBar.fillRect(250, 280, 300 * value, 30);
            percentText.setText((value * 100).toFixed(0) + '%');
        });

        this.load.on('fileprogress', (file: Phaser.Loader.File) => {
            assetText.setText('加载资源: ' + file.key);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            assetText.destroy();
        });

        // 加载基础资源
        this.loadBaseAssets();
    }

    private loadBaseAssets() {
        // 创建高质量图形纹理
        this.createPlayerTexture('player'); // 玩家纹理
        this.createEnemyTexture('enemy');   // 敌人纹理
        this.createItemTexture('item');     // 物品纹理
        this.createBulletTexture('bullet'); // 子弹纹理
        this.createWeaponTextures();        // 武器纹理
    }

    private createPlayerTexture(key: string) {
        // 创建4个独立的玩家纹理帧
        for (let frame = 0; frame < 4; frame++) {
            const graphics = this.add.graphics();
            
            // 玩家主体 - 圆形
            graphics.fillStyle(0x00ff00, 1); // 绿色
            graphics.fillCircle(16, 16, 12);
            
            // 玩家轮廓 - 发光效果
            graphics.lineStyle(3, 0x00cc00, 1);
            graphics.strokeCircle(16, 16, 12);
            
            // 玩家细节 - 方向指示器（不同帧有不同位置）
            graphics.fillStyle(0xffffff, 1);
            const indicatorY = 8 + (frame % 2) * 2; // 轻微上下移动
            graphics.fillCircle(16, indicatorY, 3);
            
            // 生成纹理帧
            graphics.generateTexture(`${key}_frame${frame}`, 32, 32);
            graphics.destroy();
        }
    }

    private createEnemyTexture(key: string) {
        // 创建4个独立的敌人纹理帧
        for (let frame = 0; frame < 4; frame++) {
            const graphics = this.add.graphics();
            
            // 敌人主体 - 圆形
            graphics.fillStyle(0xff0000, 1); // 红色
            graphics.fillCircle(16, 16, 10);
            
            // 敌人轮廓 - 危险效果
            graphics.lineStyle(2, 0xcc0000, 1);
            graphics.strokeCircle(16, 16, 10);
            
            // 敌人细节 - 眼睛（不同帧有不同位置）
            graphics.fillStyle(0xffffff, 1);
            const eyeOffset = (frame % 2) * 2; // 轻微移动效果
            graphics.fillCircle(12 + eyeOffset, 12, 2);
            graphics.fillCircle(20 + eyeOffset, 12, 2);
            
            // 生成纹理帧
            graphics.generateTexture(`${key}_frame${frame}`, 32, 32);
            graphics.destroy();
        }
    }

    private createItemTexture(key: string) {
        const graphics = this.add.graphics();
        
        // 物品主体 - 菱形
        graphics.fillStyle(0xffff00, 1); // 黄色
        graphics.fillPoints([
            { x: 16, y: 8 },
            { x: 24, y: 16 },
            { x: 16, y: 24 },
            { x: 8, y: 16 }
        ]);
        
        // 物品轮廓 - 发光效果
        graphics.lineStyle(2, 0xcccc00, 1);
        graphics.strokePoints([
            { x: 16, y: 8 },
            { x: 24, y: 16 },
            { x: 16, y: 24 },
            { x: 8, y: 16 }
        ], true);
        
        graphics.generateTexture(key, 32, 32);
        graphics.destroy();
    }

    private createBulletTexture(key: string) {
        const graphics = this.add.graphics();
        
        // 子弹主体 - 圆形
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(16, 16, 4);
        
        // 子弹轮廓 - 发光效果
        graphics.lineStyle(1, 0xcccccc, 1);
        graphics.strokeCircle(16, 16, 4);
        
        // 子弹核心 - 高光
        graphics.fillStyle(0xffffcc, 1);
        graphics.fillCircle(14, 14, 1);
        
        graphics.generateTexture(key, 32, 32);
        graphics.destroy();
    }

    private createWeaponTextures() {
        // 创建武器图标纹理
        this.createWeaponIcon('weapon_pistol', 0xf39c12);
        this.createWeaponIcon('weapon_heavyPistol', 0xe74c3c);
        this.createWeaponIcon('weapon_smg', 0x3498db);
        this.createWeaponIcon('weapon_assaultRifle', 0x2ecc71);
        this.createWeaponIcon('weapon_rifle', 0x9b59b6);
        this.createWeaponIcon('weapon_shotgun', 0x34495e);
    }

    private createWeaponIcon(key: string, color: number) {
        const graphics = this.add.graphics();
        
        // 武器图标 - 枪形
        graphics.fillStyle(color, 1);
        graphics.fillRect(8, 12, 16, 6); // 枪身
        graphics.fillRect(20, 10, 4, 10); // 枪管
        
        // 武器轮廓
        graphics.lineStyle(1, color - 0x333333, 1);
        graphics.strokeRect(8, 12, 16, 6);
        graphics.strokeRect(20, 10, 4, 10);
        
        graphics.generateTexture(key, 32, 32);
        graphics.destroy();
    }

    create() {
        console.log('BootScene 创建完成');
        
        // 启动菜单场景
        this.scene.start('MenuScene');
    }
}

export default BootScene;