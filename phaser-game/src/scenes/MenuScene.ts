export class MenuScene extends Phaser.Scene {
    private titleText!: Phaser.GameObjects.Text;
    private buttons: Phaser.GameObjects.Text[] = [];

    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        console.log('MenuScene 创建完成');
        
        this.createBackground();
        this.createTitle();
        this.createMenuButtons();
        this.createVersionInfo();
        this.createAnimatedElements();
    }

    private createBackground() {
        // 创建深色渐变背景
        const gradient = this.add.graphics();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 深色主题渐变
        gradient.fillGradientStyle(0x0a0e27, 0x1a1f3a, 0x2c3e50, 0x0a0e27, 1);
        gradient.fillRect(0, 0, width, height);
        
        // 添加光效层
        gradient.fillStyle(0x3498db, 0.12);
        gradient.fillEllipse(centerX, height * 0.25, width * 0.5, height * 0.3);
        
        gradient.fillStyle(0x9b59b6, 0.08);
        gradient.fillEllipse(width * 0.2, height * 0.7, width * 0.4, height * 0.25);
        
        gradient.fillStyle(0xe74c3c, 0.06);
        gradient.fillEllipse(width * 0.8, height * 0.5, width * 0.3, height * 0.2);
        
        // 精致网格
        gradient.lineStyle(1, 0x34495e, 0.25);
        for (let i = 0; i <= width; i += 50) {
            gradient.lineBetween(i, 0, i, height);
        }
        for (let i = 0; i <= height; i += 50) {
            gradient.lineBetween(0, i, width, i);
        }
        
        // 星光粒子（确保在屏幕内）
        for (let i = 0; i < 40; i++) {
            const x = 50 + Math.random() * (width - 100);
            const y = 50 + Math.random() * (height - 100);
            const size = Math.random() * 2.5 + 0.5;
            gradient.fillStyle(0xffffff, Math.random() * 0.3 + 0.1);
            gradient.fillCircle(x, y, size);
        }
    }

    private createTitle() {
        const centerX = this.cameras.main.centerX;
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 标题区域位置（屏幕上方20%）
        const titleY = height * 0.2;
        
        // 主标题背景装饰
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x3498db, 0.15);
        titleBg.fillRoundedRect(centerX - 250, titleY - 60, 500, 140, 20);
        titleBg.lineStyle(3, 0x3498db, 0.4);
        titleBg.strokeRoundedRect(centerX - 250, titleY - 60, 500, 140, 20);
        
        // 主标题
        this.titleText = this.add.text(
            centerX,
            titleY,
            '🎮 搜打撤',
            {
                font: 'bold 80px Arial',
                color: '#ffffff',
                stroke: '#2c3e50',
                strokeThickness: 10,
                shadow: {
                    offsetX: 4,
                    offsetY: 4,
                    color: '#000000',
                    blur: 15,
                    stroke: true,
                    fill: true
                }
            }
        );
        this.titleText.setOrigin(0.5);
        this.titleText.setTint(0x3498db, 0x9b59b6, 0x3498db, 0x9b59b6);
        
        // 副标题
        const subtitle = this.add.text(
            centerX,
            titleY + 65,
            '💰 生存  ⚔️ 掠夺  🚁 撤离',
            {
                font: 'bold 24px Arial',
                color: '#ecf0f1',
                stroke: '#34495e',
                strokeThickness: 4,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 5
                }
            }
        );
        subtitle.setOrigin(0.5);
        
        // 装饰线
        const lineWidth = 180;
        const lineY = titleY + 95;
        
        const line1 = this.add.graphics();
        line1.lineStyle(4, 0x3498db, 0.8);
        line1.lineBetween(centerX - lineWidth - 40, lineY, centerX - 40, lineY);
        
        const line2 = this.add.graphics();
        line2.lineStyle(4, 0x3498db, 0.8);
        line2.lineBetween(centerX + 40, lineY, centerX + lineWidth + 40, lineY);
    }

    private createMenuButtons() {
        const centerX = this.cameras.main.centerX;
        const height = this.cameras.main.height;
        
        // 按钮起始位置（屏幕中央偏下）
        const startY = height * 0.45;
        
        const buttonConfigs = [
            { text: '🎯 开始游戏', scene: 'GameScene', color: 0x27ae60 },
            { text: '📦 仓库管理', scene: 'WarehouseScene', color: 0x2980b9 },
            { text: '🛒 武器商店', scene: 'ShopScene', color: 0xd35400 },
            { text: '❓ 操作说明', action: 'showInstructions', color: 0x8e44ad },
            { text: '🚪 退出游戏', action: 'exitGame', color: 0xc0392b }
        ];

        buttonConfigs.forEach((config, index) => {
            const buttonY = startY + index * 70;
            
            // 按钮背景
            const buttonBg = this.add.rectangle(
                centerX, buttonY,
                360, 55,
                config.color, 0.85
            );
            buttonBg.setStrokeStyle(4, config.color);
            buttonBg.setInteractive({ useHandCursor: true });
            
            // 按钮文字
            const button = this.add.text(
                centerX, buttonY,
                config.text,
                {
                    font: 'bold 26px Arial',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4,
                    shadow: {
                        offsetX: 2,
                        offsetY: 2,
                        color: '#000000',
                        blur: 4
                    }
                }
            );
            button.setOrigin(0.5);
            button.setInteractive({ useHandCursor: true });
            
            // 按钮交互
            const buttonHover = () => {
                buttonBg.setFillStyle(config.color, 1);
                buttonBg.setScale(1.05);
                button.setScale(1.05);
            };
            
            const buttonOut = () => {
                buttonBg.setFillStyle(config.color, 0.85);
                buttonBg.setScale(1);
                button.setScale(1);
            };
            
            const buttonClick = () => {
                buttonBg.setFillStyle(config.color, 0.7);
                buttonBg.setScale(0.95);
                button.setScale(0.95);
                this.time.delayedCall(150, () => {
                    this.handleButtonClick(config);
                });
            };
            
            button.on('pointerover', buttonHover);
            buttonBg.on('pointerover', buttonHover);
            button.on('pointerout', buttonOut);
            buttonBg.on('pointerout', buttonOut);
            button.on('pointerdown', buttonClick);
            buttonBg.on('pointerdown', buttonClick);
            
            this.buttons.push(button);
        });
    }

    private handleButtonClick(config: any) {
        console.log(`点击按钮: ${config.text}`);
        
        // 添加点击音效反馈
        this.cameras.main.flash(50, 255, 255, 255);
        
        switch (config.action) {
            case 'showInstructions':
                this.showInstructions();
                break;
            case 'exitGame':
                this.exitGame();
                break;
            default:
                if (config.scene) {
                    // 停止当前场景并启动新场景
                    this.scene.stop();
                    this.scene.start(config.scene);
                }
                break;
        }
    }

    private showInstructions() {
        // 创建说明面板背景
        const overlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000, 0.8
        );
        overlay.setInteractive();
        overlay.setDepth(1000);
        
        // 创建说明面板
        const panel = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            600, 500,
            0x2c3e50, 0.98
        );
        panel.setStrokeStyle(4, 0x3498db);
        panel.setDepth(1001);
        
        // 标题
        const title = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 200,
            '📖 游戏操作说明',
            { 
                font: 'bold 32px Arial', 
                color: '#3498db',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        title.setOrigin(0.5);
        title.setDepth(1002);
        
        // 说明内容
        const instructions = [
            '⌨️ WASD - 移动角色',
            '🖱️ 鼠标左键 - 射击攻击',
            '🔄 R键 - 换弹',
            '📦 E键 - 拾取物品',
            '🎒 Tab键 - 打开背包',
            '🚁 到达撤离点后撤离',
            '💰 收集金钱和物资',
            '⚠️ 小心敌人的射击攻击'
        ];
        
        instructions.forEach((text, index) => {
            const instruction = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY - 130 + index * 40,
                text,
                { 
                    font: 'bold 20px Arial', 
                    color: '#ecf0f1',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            instruction.setOrigin(0.5);
            instruction.setDepth(1002);
        });
        
        // 关闭按钮
        const closeButton = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 200,
            '✖ 关闭',
            { 
                font: 'bold 24px Arial', 
                color: '#ffffff',
                backgroundColor: '#e74c3c',
                padding: { x: 30, y: 12 }
            }
        );
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.setDepth(1002);
        
        closeButton.on('pointerover', () => {
            closeButton.setScale(1.1);
        });
        
        closeButton.on('pointerout', () => {
            closeButton.setScale(1);
        });
        
        closeButton.on('pointerdown', () => {
            // 销毁所有说明面板元素
            overlay.destroy();
            panel.destroy();
            title.destroy();
            closeButton.destroy();
            // 销毁所有说明文本
            this.children.getAll().forEach(child => {
                const gameObject = child as any;
                if (gameObject.depth && gameObject.depth >= 1002) {
                    gameObject.destroy();
                }
            });
        });
    }

    private exitGame() {
        const confirmed = window.confirm('确定要退出游戏吗？');
        if (confirmed) {
            window.close();
        }
    }

    private createVersionInfo() {
        this.add.text(
            15, this.cameras.main.height - 25,
            'v2.0.0 - Phaser 3 + TypeScript',
            { font: 'bold 14px Arial', color: '#7f8c8d' }
        );
    }
    
    private createAnimatedElements() {
        this.createFloatingParticles();
        this.createTwinklingStars();
        this.createTitleAnimation();
    }
    
    private createFloatingParticles() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        for (let i = 0; i < 20; i++) {
            const x = 50 + Math.random() * (width - 100);
            const y = 50 + Math.random() * (height - 100);
            const particle = this.add.circle(
                x, y,
                Math.random() * 3 + 1,
                0x3498db,
                Math.random() * 0.4 + 0.1
            );
            
            const targetY = 50 + Math.random() * (height - 100);
            const targetX = 50 + Math.random() * (width - 100);
            
            this.tweens.add({
                targets: particle,
                y: targetY,
                x: targetX,
                duration: Math.random() * 4000 + 3000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }
    
    private createTwinklingStars() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        for (let i = 0; i < 15; i++) {
            const x = 50 + Math.random() * (width - 100);
            const y = 50 + Math.random() * (height * 0.4 - 50);
            const star = this.add.circle(
                x, y,
                Math.random() * 3 + 1,
                0xffffff,
                Math.random() * 0.6 + 0.3
            );
            
            this.tweens.add({
                targets: star,
                alpha: Math.random() * 0.4 + 0.2,
                duration: Math.random() * 1500 + 800,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }
    
    private createTitleAnimation() {
        this.tweens.add({
            targets: this.titleText,
            y: this.titleText.y - 8,
            duration: 2500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        this.tweens.add({
            targets: this.titleText,
            tint: 0x9b59b6,
            duration: 3500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }
}

export default MenuScene;
