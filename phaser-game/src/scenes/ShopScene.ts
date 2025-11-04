import Phaser from 'phaser';
import { GameConstants } from '../config/gameConfig';

// 商店物品接口
interface ShopItem {
    id: string;
    name: string;
    type: 'weapon' | 'armor' | 'medical' | 'ammo';
    price: number;
    basePrice: number; // 基础价格（用于价格波动）
    description: string;
    stock: number; // 库存数量
}

export class ShopScene extends Phaser.Scene {
    private playerMoney: number = 0;
    private shopItems: ShopItem[] = [];
    private selectedItem: ShopItem | null = null;
    private priceFluctuationTimer: number = 0;

    constructor() {
        super({ key: 'ShopScene' });
    }

    init(data: any) {
        this.playerMoney = data.playerMoney || 0;
        this.loadShopItems();
    }

    create() {
        console.log('商店场景创建完成');
        
        this.createBackground();
        this.createShopUI();
        this.createShopItems();
        this.createActionButtons();
        this.createPriceFluctuationSystem();
    }

    private createBackground() {
        const graphics = this.add.graphics();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 深色渐变背景
        graphics.fillGradientStyle(0x1a1f3a, 0x2c3e50, 0x34495e, 0x1a1f3a, 1);
        graphics.fillRect(0, 0, width, height);
        
        // 标题区域背景
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x2c3e50, 0.8);
        titleBg.fillRoundedRect(width * 0.05, height * 0.03, width * 0.9, 70, 10);
        titleBg.lineStyle(3, 0xf39c12, 0.8);
        titleBg.strokeRoundedRect(width * 0.05, height * 0.03, width * 0.9, 70, 10);
        
        // 标题
        const title = this.add.text(
            width / 2,
            height * 0.03 + 35,
            '🛒 武器商店',
            { 
                font: 'bold 36px Arial', 
                color: '#f39c12',
                stroke: '#2c3e50',
                strokeThickness: 4
            }
        );
        title.setOrigin(0.5);
        
        // 副标题
        const subtitle = this.add.text(
            width / 2,
            height * 0.03 + 65,
            '💰 购买武器和装备',
            { 
                font: '18px Arial', 
                color: '#95a5a6'
            }
        );
        subtitle.setOrigin(0.5, 0);
    }

    private loadShopItems() {
        // 初始化商店物品
        this.shopItems = [
            {
                id: 'pistol',
                name: '手枪',
                type: 'weapon',
                price: 500,
                basePrice: 500,
                description: '基础自卫武器',
                stock: 5
            },
            {
                id: 'rifle',
                name: '步枪',
                type: 'weapon',
                price: 1200,
                basePrice: 1200,
                description: '中距离战斗武器',
                stock: 3
            },
            {
                id: 'shotgun',
                name: '霰弹枪',
                type: 'weapon',
                price: 1500,
                basePrice: 1500,
                description: '近距离高伤害武器',
                stock: 2
            },
            {
                id: 'armor_light',
                name: '轻型护甲',
                type: 'armor',
                price: 300,
                basePrice: 300,
                description: '提供基础防护',
                stock: 10
            },
            {
                id: 'armor_heavy',
                name: '重型护甲',
                type: 'armor',
                price: 800,
                basePrice: 800,
                description: '提供高级防护',
                stock: 5
            },
            {
                id: 'medkit',
                name: '医疗包',
                type: 'medical',
                price: 200,
                basePrice: 200,
                description: '恢复生命值',
                stock: 20
            },
            {
                id: 'ammo_pistol',
                name: '手枪弹药',
                type: 'ammo',
                price: 100,
                basePrice: 100,
                description: '手枪弹药',
                stock: 50
            },
            {
                id: 'ammo_rifle',
                name: '步枪弹药',
                type: 'ammo',
                price: 150,
                basePrice: 150,
                description: '步枪弹药',
                stock: 50
            }
        ];
    }

    private createShopUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 金钱显示面板
        const moneyBg = this.add.graphics();
        moneyBg.fillStyle(0x2c3e50, 0.85);
        moneyBg.fillRoundedRect(width * 0.7, height * 0.11, width * 0.25, 50, 8);
        moneyBg.lineStyle(3, 0xf1c40f, 0.8);
        moneyBg.strokeRoundedRect(width * 0.7, height * 0.11, width * 0.25, 50, 8);
        
        // 玩家金钱显示
        const moneyText = this.add.text(
            width * 0.825,
            height * 0.135,
            `💰 金钱: $${this.playerMoney}`,
            { 
                font: 'bold 22px Arial', 
                color: '#f1c40f',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        moneyText.setOrigin(0.5);
        
        // 保存moneyText引用以便更新
        (this as any).moneyText = moneyText;
    }

    private createShopItems() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const itemWidth = 180;
        const itemHeight = 140;
        const itemsPerRow = 4;
        const itemSpacing = 20;
        
        const totalWidth = itemsPerRow * itemWidth + (itemsPerRow - 1) * itemSpacing;
        const startX = (width - totalWidth) / 2;
        const startY = height * 0.2;
        
        this.shopItems.forEach((item, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            const x = startX + col * (itemWidth + itemSpacing);
            const y = startY + row * (itemHeight + itemSpacing);
            
            // 创建物品卡片
            const card = this.add.graphics();
            card.fillStyle(0x34495e, 0.9);
            card.fillRoundedRect(x, y, itemWidth, itemHeight, 10);
            
            // 根据类型设置不同颜色的边框
            const borderColor = this.getItemBorderColor(item.type);
            card.lineStyle(3, borderColor);
            card.strokeRoundedRect(x, y, itemWidth, itemHeight, 10);
            
            // 类型标签
            const typeLabel = this.add.text(
                x + 10, y + 10,
                this.getItemTypeLabel(item.type),
                {
                    font: 'bold 12px Arial',
                    color: '#95a5a6',
                    backgroundColor: '#2c3e50',
                    padding: { x: 6, y: 3 }
                }
            );
            
            // 物品名称
            const nameText = this.add.text(
                x + itemWidth / 2,
                y + 40,
                item.name,
                {
                    font: 'bold 18px Arial',
                    color: '#ecf0f1',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            nameText.setOrigin(0.5);
            
            // 价格（带波动显示）
            const priceColor = item.price > item.basePrice ? '#e74c3c' : 
                              (item.price < item.basePrice ? '#2ecc71' : '#f39c12');
            const priceText = this.add.text(
                x + itemWidth / 2,
                y + 65,
                `$${item.price}`,
                {
                    font: 'bold 16px Arial',
                    color: priceColor,
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            priceText.setOrigin(0.5);
            
            // 库存
            const stockText = this.add.text(
                x + itemWidth / 2,
                y + 90,
                `📦 库存: ${item.stock}`,
                {
                    font: '13px Arial',
                    color: item.stock > 0 ? '#95a5a6' : '#e74c3c'
                }
            );
            stockText.setOrigin(0.5);
            
            // 购买按钮
            const buyButton = this.add.rectangle(
                x + itemWidth / 2,
                y + 118,
                140, 28,
                item.stock > 0 ? 0x27ae60 : 0x7f8c8d,
                0.9
            );
            buyButton.setInteractive({ useHandCursor: item.stock > 0 });
            buyButton.setStrokeStyle(2, item.stock > 0 ? 0x27ae60 : 0x7f8c8d);
            
            const buyText = this.add.text(
                x + itemWidth / 2,
                y + 118,
                item.stock > 0 ? '💲 购买' : '已售罄',
                {
                    font: 'bold 14px Arial',
                    color: '#ffffff'
                }
            );
            buyText.setOrigin(0.5);
            
            // 按钮交互
            if (item.stock > 0) {
                buyButton.on('pointerover', () => {
                    buyButton.setFillStyle(0x2ecc71, 1);
                    buyButton.setScale(1.05);
                    buyText.setScale(1.05);
                });
                
                buyButton.on('pointerout', () => {
                    buyButton.setFillStyle(0x27ae60, 0.9);
                    buyButton.setScale(1);
                    buyText.setScale(1);
                });
                
                buyButton.on('pointerdown', () => {
                    this.buyItem(item, priceText, stockText, buyButton, buyText);
                });
            }
            
            // 保存引用以便更新
            (item as any).priceText = priceText;
            (item as any).stockText = stockText;
            (item as any).buyButton = buyButton;
            (item as any).buyText = buyText;
        });
    }
    
    private getItemBorderColor(type: string): number {
        switch (type) {
            case 'weapon': return 0xe74c3c;
            case 'armor': return 0x3498db;
            case 'medical': return 0x2ecc71;
            case 'ammo': return 0xf39c12;
            default: return 0x95a5a6;
        }
    }
    
    private getItemTypeLabel(type: string): string {
        switch (type) {
            case 'weapon': return '⚔️ 武器';
            case 'armor': return '🛡️ 护甲';
            case 'medical': return '⚕️ 医疗';
            case 'ammo': return '💥 弹药';
            default: return '❓ 其他';
        }
    }

    private buyItem(
        item: ShopItem, 
        priceText: Phaser.GameObjects.Text,
        stockText: Phaser.GameObjects.Text,
        buyButton: Phaser.GameObjects.Rectangle,
        buyText: Phaser.GameObjects.Text
    ) {
        if (this.playerMoney >= item.price && item.stock > 0) {
            this.playerMoney -= item.price;
            item.stock--;
            
            // 更新显示
            (this as any).moneyText?.setText(`💰 金钱: $${this.playerMoney}`);
            stockText.setText(`📦 库存: ${item.stock}`);
            
            // 如果库存为0，更新按钮状态
            if (item.stock === 0) {
                buyButton.setFillStyle(0x7f8c8d, 0.9);
                buyButton.disableInteractive();
                buyText.setText('已售罄');
                stockText.setColor('#e74c3c');
            }
            
            // 保存到仓库
            this.saveToWarehouse(item);
            
            // 显示购买成功消息
            this.showMessage(`成功购买 ${item.name}！`, '#2ecc71');
        } else if (this.playerMoney < item.price) {
            this.showMessage('金钱不足！', '#e74c3c');
        } else {
            this.showMessage('库存不足！', '#e74c3c');
        }
    }

    private saveToWarehouse(item: ShopItem) {
        try {
            const savedInventory = localStorage.getItem('game_inventory');
            let inventory: any[] = savedInventory ? JSON.parse(savedInventory) : [];
            
            // 检查是否已存在相同物品
            const existingItem = inventory.find(i => i.name === item.name);
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + 1;
            } else {
                inventory.push({
                    id: Date.now(),
                    type: item.type.toUpperCase(),
                    name: item.name,
                    value: item.basePrice,
                    quantity: 1,
                    description: item.description
                });
            }
            
            localStorage.setItem('game_inventory', JSON.stringify(inventory));
            localStorage.setItem('player_money', this.playerMoney.toString());
        } catch (error) {
            console.error('保存到仓库失败:', error);
        }
    }

    private createPriceFluctuationSystem() {
        // 每30秒更新一次价格
        this.time.addEvent({
            delay: 30000,
            callback: this.updatePrices,
            callbackScope: this,
            loop: true
        });
    }

    private updatePrices() {
        this.shopItems.forEach(item => {
            // 价格波动范围：±20%
            const fluctuation = (Math.random() - 0.5) * 0.4; // -0.2 到 +0.2
            item.price = Math.floor(item.basePrice * (1 + fluctuation));
            
            // 更新价格显示
            if ((item as any).priceText) {
                (item as any).priceText.setText(`$${item.price}`);
                (item as any).priceText.setColor(
                    item.price > item.basePrice ? '#e74c3c' : 
                    (item.price < item.basePrice ? '#2ecc71' : '#f39c12')
                );
            }
        });
        
        this.showMessage('价格已更新', '#3498db');
    }

    private createActionButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const buttonY = height * 0.9;
        const buttonWidth = 160;
        const buttonHeight = 45;
        
        // 返回按钮
        const returnButton = this.add.rectangle(
            width / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x95a5a6,
            0.85
        );
        returnButton.setStrokeStyle(3, 0x95a5a6);
        returnButton.setInteractive({ useHandCursor: true });
        
        const returnText = this.add.text(
            width / 2,
            buttonY,
            '⬅️ 返回菜单',
            { 
                font: 'bold 18px Arial', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        returnText.setOrigin(0.5);
        
        returnButton.on('pointerover', () => {
            returnButton.setFillStyle(0x95a5a6, 1);
            returnButton.setScale(1.05);
            returnText.setScale(1.05);
        });
        
        returnButton.on('pointerout', () => {
            returnButton.setFillStyle(0x95a5a6, 0.85);
            returnButton.setScale(1);
            returnText.setScale(1);
        });
        
        returnButton.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }

    private showMessage(message: string, color: string) {
        const msgText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.height * 0.85,
            message,
            {
                font: '18px Arial',
                color: color,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 15, y: 8 }
            }
        );
        msgText.setOrigin(0.5);
        
        this.tweens.add({
            targets: msgText,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            onComplete: () => msgText.destroy()
        });
    }
}

export default ShopScene;

