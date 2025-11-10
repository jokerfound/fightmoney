import Phaser from 'phaser';

// 商店物品接口
interface ShopItem {
    id: string;
    name: string;
    type: 'weapon' | 'armor' | 'medical' | 'ammo';
    subtype?: string;
    price: number;
    basePrice: number; // 基础价格（用于价格波动）
    description: string;
    stock: number; // 库存数量
    rarity?: string; // 稀有度
    damage?: number; // 武器伤害
    armorValue?: number; // 护甲值
    healAmount?: number; // 治疗量
}

// 仓库物品接口（用于出售）
interface WarehouseItem {
    id: number;
    type: string;
    name: string;
    value: number;
    quantity: number;
    description: string;
    rarity?: string;
}

export class ShopScene extends Phaser.Scene {
    private playerMoney: number = 0;
    private shopItems: ShopItem[] = []; // 可购买物品
    private warehouseItems: WarehouseItem[] = []; // 仓库物品（用于出售）
    private moneyText!: Phaser.GameObjects.Text;
    private shopItemDetailPanel: Phaser.GameObjects.Container | null = null;
    private warehouseItemDetailPanel: Phaser.GameObjects.Container | null = null;

    constructor() {
        super({ key: 'ShopScene' });
    }

    init(data: any) {
        // 从localStorage加载金钱
        try {
            const savedMoney = localStorage.getItem('player_money');
            if (savedMoney) {
                const savedMoneyValue = parseInt(savedMoney, 10);
                this.playerMoney = Math.max(data.playerMoney || 0, savedMoneyValue);
            } else {
                // 如果没有保存的金钱数据，设置初始资金为1000
                this.playerMoney = data.playerMoney || 1000;
            }
            
            // 如果金钱为0且没有保存数据，设置为初始资金1000
            if (this.playerMoney === 0 && !savedMoney && !data.playerMoney) {
                this.playerMoney = 1000;
            }
        } catch (error) {
            console.warn('加载金钱数据失败:', error);
            // 如果出错，设置初始资金为1000
            this.playerMoney = data.playerMoney || 1000;
        }
        
        // 确保金钱数据保存
        if (this.playerMoney >= 0) {
            localStorage.setItem('player_money', this.playerMoney.toString());
        }
        
        // 加载仓库物品
        this.loadWarehouseItems();
        
        // 加载商店物品
        this.loadShopItems();
        
        console.log(`商店场景初始化: 金钱=$${this.playerMoney}, 仓库物品=${this.warehouseItems.length}`);
    }

    create() {
        console.log('商店场景创建完成');
        
        this.createBackground();
        this.createHeader();
        this.createSellSection(); // 左侧：出售区域
        this.createBuySection(); // 右侧：购买区域
        this.createActionButtons();
        this.startPriceFluctuation();
        this.setupKeyboardControls();
    }
    
    private setupKeyboardControls() {
        // ESC键返回主菜单
        this.input.keyboard?.on('keydown-ESC', () => {
            this.scene.start('MenuScene', { playerMoney: this.playerMoney });
        });
    }

    private createBackground() {
        const graphics = this.add.graphics();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 深色渐变背景
        graphics.fillGradientStyle(0x1a1f3a, 0x2c3e50, 0x34495e, 0x1a1f3a, 1);
        graphics.fillRect(0, 0, width, height);
        graphics.setDepth(0);
    }

    private createHeader() {
        const width = this.cameras.main.width;
        
        // 标题区域背景
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x2c3e50, 0.9);
        titleBg.fillRoundedRect(0, 0, width, 90, 0);
        titleBg.lineStyle(3, 0xf39c12, 0.8);
        titleBg.strokeRoundedRect(0, 0, width, 90, 0);
        titleBg.setDepth(1000);
        
        // 标题
        const title = this.add.text(
            width / 2,
            30,
            '🛒 武器商店',
            { 
                font: 'bold 40px Arial', 
                color: '#f39c12',
                stroke: '#000000',
                strokeThickness: 4
            }
        );
        title.setOrigin(0.5);
        title.setDepth(1001);
        
        // 副标题
        const subtitle = this.add.text(
            width / 2,
            70,
            '💰 出售物资 | 🔫 购买装备',
            { 
                font: '20px Arial', 
                color: '#95a5a6',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        subtitle.setOrigin(0.5);
        subtitle.setDepth(1001);
        
        // 金钱显示（右上角，确保在屏幕内）
        const moneyPanelWidth = 200;
        const moneyPanelHeight = 50;
        const moneyPanelX = Math.max(20, width - moneyPanelWidth - 20); // 确保不超出屏幕右边界
        const moneyPanelY = 10;
        
        const moneyBg = this.add.graphics();
        moneyBg.fillStyle(0x2c3e50, 0.9);
        moneyBg.fillRoundedRect(moneyPanelX, moneyPanelY, moneyPanelWidth, moneyPanelHeight, 8);
        moneyBg.lineStyle(3, 0xf1c40f, 0.9);
        moneyBg.strokeRoundedRect(moneyPanelX, moneyPanelY, moneyPanelWidth, moneyPanelHeight, 8);
        moneyBg.setDepth(1000);
        
        this.moneyText = this.add.text(
            moneyPanelX + moneyPanelWidth / 2,
            moneyPanelY + moneyPanelHeight / 2,
            `💰 金钱: $${this.playerMoney}`,
            { 
                font: 'bold 24px Arial', 
                color: '#f1c40f',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.moneyText.setOrigin(0.5);
        this.moneyText.setDepth(1001);
    }

    private loadWarehouseItems() {
        try {
            const savedInventory = localStorage.getItem('game_inventory');
            if (savedInventory) {
                this.warehouseItems = JSON.parse(savedInventory);
            } else {
                this.warehouseItems = [];
            }
        } catch (error) {
            console.error('加载仓库物品失败:', error);
            this.warehouseItems = [];
        }
    }

    private loadShopItems() {
        // 初始化商店可购买物品
        this.shopItems = [
            // 武器类
            {
                id: 'weapon_pistol',
                name: '🔫 手枪',
                type: 'weapon',
                subtype: 'pistol',
                price: 500,
                basePrice: 500,
                description: '基础自卫武器，平衡型',
                stock: 10,
                rarity: 'common',
                damage: 20
            },
            {
                id: 'weapon_rifle',
                name: '🔫 步枪',
                type: 'weapon',
                subtype: 'rifle',
                price: 1200,
                basePrice: 1200,
                description: '主力武器，支持全自动连射',
                stock: 5,
                rarity: 'rare',
                damage: 30
            },
            {
                id: 'weapon_shotgun',
                name: '🔫 霰弹枪',
                type: 'weapon',
                subtype: 'shotgun',
                price: 1500,
                basePrice: 1500,
                description: '近距离高伤害，散射攻击',
                stock: 3,
                rarity: 'rare',
                damage: 50
            },
            {
                id: 'weapon_sniper',
                name: '🔫 狙击枪',
                type: 'weapon',
                subtype: 'sniper',
                price: 2500,
                basePrice: 2500,
                description: '远距离高精度，单发高伤害',
                stock: 2,
                rarity: 'epic',
                damage: 80
            },
            // 护甲类（根据稀有度设置护甲值）
            {
                id: 'armor_light',
                name: '🛡️ 轻型护甲',
                type: 'armor',
                price: 100,
                basePrice: 100,
                description: '普通护甲，提供10点防护（使用后消失）',
                stock: 15,
                rarity: 'common',
                armorValue: 10  // 普通：10点
            },
            {
                id: 'armor_medium',
                name: '🛡️ 中型护甲',
                type: 'armor',
                price: 300,
                basePrice: 300,
                description: '不常见护甲，提供25点防护（使用后消失）',
                stock: 10,
                rarity: 'uncommon',
                armorValue: 25  // 不常见：25点
            },
            {
                id: 'armor_heavy',
                name: '🛡️ 重型护甲',
                type: 'armor',
                price: 800,
                basePrice: 800,
                description: '稀有护甲，提供55点防护（使用后消失）',
                stock: 5,
                rarity: 'rare',
                armorValue: 55  // 稀有：55点
            },
            {
                id: 'armor_epic',
                name: '🛡️ 史诗护甲',
                type: 'armor',
                price: 1500,
                basePrice: 1500,
                description: '史诗护甲，提供75点防护（使用后消失）',
                stock: 3,
                rarity: 'epic',
                armorValue: 75  // 史诗：75点
            },
            {
                id: 'armor_legendary',
                name: '🛡️ 传说护甲',
                type: 'armor',
                price: 3000,
                basePrice: 3000,
                description: '传说护甲，提供100点防护（使用后消失）',
                stock: 1,
                rarity: 'legendary',
                armorValue: 100  // 传说：100点
            },
            // 医疗类
            {
                id: 'medical_bandage',
                name: '🩹 绷带',
                type: 'medical',
                price: 50,
                basePrice: 50,
                description: '基础医疗用品',
                stock: 50,
                rarity: 'common',
                healAmount: 5
            },
            {
                id: 'medical_medkit',
                name: '💊 医疗包',
                type: 'medical',
                price: 200,
                basePrice: 200,
                description: '恢复生命值',
                stock: 30,
                rarity: 'uncommon',
                healAmount: 20
            },
            // 弹药类（四种枪械对应的子弹，每种有多个规格）
            // 手枪弹药（便宜、大量供应）
            {
                id: 'ammo_pistol_small',
                name: '📦 手枪弹药(小)',
                type: 'ammo',
                subtype: 'pistol',
                price: 20,
                basePrice: 20,
                description: '手枪弹药（15发）',
                stock: 200,
                rarity: 'common'
            },
            {
                id: 'ammo_pistol_medium',
                name: '📦 手枪弹药(中)',
                type: 'ammo',
                subtype: 'pistol',
                price: 35,
                basePrice: 35,
                description: '手枪弹药（30发）',
                stock: 150,
                rarity: 'common'
            },
            {
                id: 'ammo_pistol_large',
                name: '📦 手枪弹药(大)',
                type: 'ammo',
                subtype: 'pistol',
                price: 60,
                basePrice: 60,
                description: '手枪弹药（60发）',
                stock: 100,
                rarity: 'common'
            },
            // 步枪弹药（中等价格、中等库存）
            {
                id: 'ammo_rifle_small',
                name: '📦 步枪弹药(小)',
                type: 'ammo',
                subtype: 'rifle',
                price: 40,
                basePrice: 40,
                description: '步枪弹药（30发）',
                stock: 120,
                rarity: 'uncommon'
            },
            {
                id: 'ammo_rifle_medium',
                name: '📦 步枪弹药(中)',
                type: 'ammo',
                subtype: 'rifle',
                price: 70,
                basePrice: 70,
                description: '步枪弹药（60发）',
                stock: 100,
                rarity: 'uncommon'
            },
            {
                id: 'ammo_rifle_large',
                name: '📦 步枪弹药(大)',
                type: 'ammo',
                subtype: 'rifle',
                price: 120,
                basePrice: 120,
                description: '步枪弹药（120发）',
                stock: 80,
                rarity: 'uncommon'
            },
            // 霄弹枪弹药（较贵、有限库存）
            {
                id: 'ammo_shotgun_small',
                name: '📦 霄弹枪弹药(小)',
                type: 'ammo',
                subtype: 'shotgun',
                price: 50,
                basePrice: 50,
                description: '霄弹枪弹药（7发）',
                stock: 100,
                rarity: 'uncommon'
            },
            {
                id: 'ammo_shotgun_medium',
                name: '📦 霄弹枪弹药(中)',
                type: 'ammo',
                subtype: 'shotgun',
                price: 90,
                basePrice: 90,
                description: '霄弹枪弹药（14发）',
                stock: 80,
                rarity: 'uncommon'
            },
            {
                id: 'ammo_shotgun_large',
                name: '📦 霄弹枪弹药(大)',
                type: 'ammo',
                subtype: 'shotgun',
                price: 150,
                basePrice: 150,
                description: '霄弹枪弹药（28发）',
                stock: 60,
                rarity: 'uncommon'
            },
            // 狙击枪弹药（最贵、稀有）
            {
                id: 'ammo_sniper_small',
                name: '📦 狙击枪弹药(小)',
                type: 'ammo',
                subtype: 'sniper',
                price: 80,
                basePrice: 80,
                description: '狙击枪弹药（5发）',
                stock: 60,
                rarity: 'rare'
            },
            {
                id: 'ammo_sniper_medium',
                name: '📦 狙击枪弹药(中)',
                type: 'ammo',
                subtype: 'sniper',
                price: 150,
                basePrice: 150,
                description: '狙击枪弹药（10发）',
                stock: 50,
                rarity: 'rare'
            },
            {
                id: 'ammo_sniper_large',
                name: '📦 狙击枪弹药(大)',
                type: 'ammo',
                subtype: 'sniper',
                price: 250,
                basePrice: 250,
                description: '狙击枪弹药（20发）',
                stock: 40,
                rarity: 'rare'
            }
        ];
    }

    private createSellSection() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 出售区域（左侧）
        const sellAreaX = 20;
        const sellAreaY = 110;
        const sellAreaWidth = width / 2 - 30;
        const sellAreaHeight = height - 200;
        
        // 出售区域背景
        const sellBg = this.add.graphics();
        sellBg.fillStyle(0x2c3e50, 0.8);
        sellBg.fillRoundedRect(sellAreaX, sellAreaY, sellAreaWidth, sellAreaHeight, 10);
        sellBg.lineStyle(3, 0xe74c3c, 0.8);
        sellBg.strokeRoundedRect(sellAreaX, sellAreaY, sellAreaWidth, sellAreaHeight, 10);
        sellBg.setDepth(500);
        
        // 出售区域标题
        const sellTitle = this.add.text(
            sellAreaX + sellAreaWidth / 2,
            sellAreaY + 30,
            '💰 出售物资',
            {
                font: 'bold 28px Arial',
                color: '#e74c3c',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        sellTitle.setOrigin(0.5);
        sellTitle.setDepth(501);
        
        // 创建物品槽位
        const slotSize = 80;
        const slotsPerRow = 5;
        const slotSpacing = 15;
        const startX = sellAreaX + 20;
        const startY = sellAreaY + 80;
        const maxSlots = 20; // 最多显示20个物品
        
        let slotIndex = 0;
        this.warehouseItems.forEach((item, index) => {
            if (slotIndex >= maxSlots) return;
            
            const row = Math.floor(slotIndex / slotsPerRow);
            const col = slotIndex % slotsPerRow;
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            // 检查是否超出区域
            if (y + slotSize > sellAreaY + sellAreaHeight - 20) return;
            
            // 创建物品槽
            const slot = this.add.graphics();
            const rarityColor = this.getRarityColor(item.rarity || 'common');
            slot.fillStyle(rarityColor, 0.8);
            slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
            slot.lineStyle(2, rarityColor, 1);
            slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            slot.setInteractive(new Phaser.Geom.Rectangle(x, y, slotSize, slotSize), Phaser.Geom.Rectangle.Contains);
            slot.setDepth(501);
            
            // 物品名称（简化显示）
            const itemName = this.add.text(
                x + slotSize / 2,
                y + 20,
                item.name.length > 4 ? item.name.substring(0, 4) : item.name,
                {
                    font: 'bold 12px Arial',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            itemName.setOrigin(0.5);
            itemName.setDepth(502);
            
            // 数量
            const quantityText = this.add.text(
                x + slotSize / 2,
                y + 40,
                `x${item.quantity}`,
                {
                    font: 'bold 14px Arial',
                    color: '#f39c12',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            quantityText.setOrigin(0.5);
            quantityText.setDepth(502);
            
            // 价值
            const valueText = this.add.text(
                x + slotSize / 2,
                y + 60,
                `$${item.value * item.quantity}`,
                {
                    font: '12px Arial',
                    color: '#2ecc71',
                    stroke: '#000000',
                    strokeThickness: 1
                }
            );
            valueText.setOrigin(0.5);
            valueText.setDepth(502);
            
            // 点击事件
            slot.on('pointerover', () => {
                slot.clear();
                slot.fillStyle(rarityColor, 1);
                slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                slot.lineStyle(3, 0xf39c12, 1);
                slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            });
            
            slot.on('pointerout', () => {
                slot.clear();
                slot.fillStyle(rarityColor, 0.8);
                slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                slot.lineStyle(2, rarityColor, 1);
                slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            });
            
            slot.on('pointerdown', () => {
                this.selectWarehouseItem(item, index);
            });
            
            slotIndex++;
        });
        
        // 如果没有物品，显示提示
        if (this.warehouseItems.length === 0) {
            const emptyText = this.add.text(
                sellAreaX + sellAreaWidth / 2,
                sellAreaY + sellAreaHeight / 2,
                '仓库中没有可出售的物品',
                {
                    font: '20px Arial',
                    color: '#95a5a6',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            emptyText.setOrigin(0.5);
            emptyText.setDepth(501);
        }
    }

    private createBuySection() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 购买区域（右侧）
        const buyAreaX = width / 2 + 10;
        const buyAreaY = 110;
        const buyAreaWidth = width / 2 - 30;
        const buyAreaHeight = height - 200;
        
        // 购买区域背景
        const buyBg = this.add.graphics();
        buyBg.fillStyle(0x2c3e50, 0.8);
        buyBg.fillRoundedRect(buyAreaX, buyAreaY, buyAreaWidth, buyAreaHeight, 10);
        buyBg.lineStyle(3, 0x27ae60, 0.8);
        buyBg.strokeRoundedRect(buyAreaX, buyAreaY, buyAreaWidth, buyAreaHeight, 10);
        buyBg.setDepth(500);
        
        // 购买区域标题
        const buyTitle = this.add.text(
            buyAreaX + buyAreaWidth / 2,
            buyAreaY + 30,
            '🔫 购买装备',
            {
                font: 'bold 28px Arial',
                color: '#27ae60',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        buyTitle.setOrigin(0.5);
        buyTitle.setDepth(501);
        
        // 创建滚动区域
        const itemSlotSize = 100;
        const itemsPerRow = 3;
        const itemSpacing = 15;
        const itemStartX = buyAreaX + 20;
        const itemStartY = buyAreaY + 80;
        const maxVisibleRows = Math.floor((buyAreaHeight - 100) / (itemSlotSize + itemSpacing));
        
        this.shopItems.forEach((item, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            
            // 只显示可见的物品
            if (row >= maxVisibleRows) return;
            
            const x = itemStartX + col * (itemSlotSize + itemSpacing);
            const y = itemStartY + row * (itemSlotSize + itemSpacing);
            
            // 创建物品卡片
            const card = this.add.graphics();
            const rarityColor = this.getRarityColor(item.rarity || 'common');
            card.fillStyle(rarityColor, 0.8);
            card.fillRoundedRect(x, y, itemSlotSize, itemSlotSize, 8);
            card.lineStyle(3, rarityColor, 1);
            card.strokeRoundedRect(x, y, itemSlotSize, itemSlotSize, 8);
            card.setInteractive(new Phaser.Geom.Rectangle(x, y, itemSlotSize, itemSlotSize), Phaser.Geom.Rectangle.Contains);
            card.setDepth(501);
            
            // 物品名称
            const nameText = this.add.text(
                x + itemSlotSize / 2,
                y + 25,
                item.name,
                {
                    font: 'bold 14px Arial',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            nameText.setOrigin(0.5);
            nameText.setDepth(502);
            
            // 价格
            const priceText = this.add.text(
                x + itemSlotSize / 2,
                y + 50,
                `$${item.price}`,
                {
                    font: 'bold 16px Arial',
                    color: '#f39c12',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            priceText.setOrigin(0.5);
            priceText.setDepth(502);
            
            // 库存
            const stockText = this.add.text(
                x + itemSlotSize / 2,
                y + 75,
                `库存: ${item.stock}`,
                {
                    font: '12px Arial',
                    color: item.stock > 0 ? '#95a5a6' : '#e74c3c',
                    stroke: '#000000',
                    strokeThickness: 1
                }
            );
            stockText.setOrigin(0.5);
            stockText.setDepth(502);
            
            // 悬停效果
            card.on('pointerover', () => {
                card.clear();
                card.fillStyle(rarityColor, 1);
                card.fillRoundedRect(x, y, itemSlotSize, itemSlotSize, 8);
                card.lineStyle(4, 0xf39c12, 1);
                card.strokeRoundedRect(x, y, itemSlotSize, itemSlotSize, 8);
            });
            
            card.on('pointerout', () => {
                card.clear();
                card.fillStyle(rarityColor, 0.8);
                card.fillRoundedRect(x, y, itemSlotSize, itemSlotSize, 8);
                card.lineStyle(3, rarityColor, 1);
                card.strokeRoundedRect(x, y, itemSlotSize, itemSlotSize, 8);
            });
            
            card.on('pointerdown', () => {
                this.selectShopItem(item);
            });
            
            // 保存引用
            (item as any).priceText = priceText;
            (item as any).stockText = stockText;
        });
    }

    private selectWarehouseItem(item: WarehouseItem, index: number) {
        this.showWarehouseItemDetails(item, index);
    }

    private selectShopItem(item: ShopItem) {
        this.showShopItemDetails(item);
    }

    private showWarehouseItemDetails(item: WarehouseItem, index: number) {
        // 隐藏之前的详情面板
        if (this.warehouseItemDetailPanel) {
            this.warehouseItemDetailPanel.destroy();
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 详情面板（左侧底部）
        const panelWidth = width / 2 - 40;
        const panelHeight = 180;
        const panelX = 20;
        const panelY = height - panelHeight - 100;
        
        const detailPanel = this.add.container(0, 0);
        detailPanel.setDepth(2000);
        
        // 背景
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1a1a, 0.95);
        bg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        bg.lineStyle(3, 0xe74c3c, 0.9);
        bg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        detailPanel.add(bg);
        
        // 标题
        const title = this.add.text(panelX + panelWidth / 2, panelY + 25, item.name, {
            fontSize: '22px',
            color: '#e74c3c',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        title.setOrigin(0.5);
        detailPanel.add(title);
        
        // 详细信息
        let detailY = panelY + 60;
        const details = [
            { label: '类型', value: item.type, color: '#3498db' },
            { label: '数量', value: `${item.quantity}`, color: '#2ecc71' },
            { label: '单价', value: `$${item.value}`, color: '#f39c12' },
            { label: '总价值', value: `$${item.value * item.quantity}`, color: '#f1c40f' }
        ];
        
        details.forEach(detail => {
            const labelText = this.add.text(panelX + 20, detailY, `${detail.label}:`, {
                fontSize: '14px',
                color: '#bdc3c7',
                stroke: '#000000',
                strokeThickness: 2
            });
            detailPanel.add(labelText);
            
            const valueText = this.add.text(panelX + panelWidth - 20, detailY, detail.value, {
                fontSize: '14px',
                color: detail.color,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            valueText.setOrigin(1, 0);
            detailPanel.add(valueText);
            
            detailY += 25;
        });
        
        // 出售按钮
        const sellButtonBg = this.add.graphics();
        sellButtonBg.fillStyle(0xe74c3c, 0.9);
        sellButtonBg.fillRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
        sellButtonBg.lineStyle(2, 0xc0392b, 1);
        sellButtonBg.strokeRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
        detailPanel.add(sellButtonBg);
        
        const sellButtonText = this.add.text(
            panelX + panelWidth / 2,
            panelY + panelHeight - 32,
            `💰 出售 (获得 $${item.value * item.quantity})`,
            {
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        sellButtonText.setOrigin(0.5);
        sellButtonText.setInteractive({ useHandCursor: true });
        
        sellButtonText.on('pointerover', () => {
            sellButtonBg.clear();
            sellButtonBg.fillStyle(0xe74c3c, 1);
            sellButtonBg.fillRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
            sellButtonBg.lineStyle(2, 0xc0392b, 1);
            sellButtonBg.strokeRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
        });
        
        sellButtonText.on('pointerout', () => {
            sellButtonBg.clear();
            sellButtonBg.fillStyle(0xe74c3c, 0.9);
            sellButtonBg.fillRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
            sellButtonBg.lineStyle(2, 0xc0392b, 1);
            sellButtonBg.strokeRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
        });
        
        sellButtonText.on('pointerdown', () => {
            this.sellItem(item, index);
        });
        detailPanel.add(sellButtonText);
        
        this.warehouseItemDetailPanel = detailPanel;
    }

    private showShopItemDetails(item: ShopItem) {
        // 隐藏之前的详情面板
        if (this.shopItemDetailPanel) {
            this.shopItemDetailPanel.destroy();
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 详情面板（右侧底部）
        const panelWidth = width / 2 - 40;
        const panelHeight = 200;
        const panelX = width / 2 + 10;
        const panelY = height - panelHeight - 100;
        
        const detailPanel = this.add.container(0, 0);
        detailPanel.setDepth(2000);
        
        // 背景
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1a1a, 0.95);
        bg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        bg.lineStyle(3, 0x27ae60, 0.9);
        bg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        detailPanel.add(bg);
        
        // 标题
        const title = this.add.text(panelX + panelWidth / 2, panelY + 25, item.name, {
            fontSize: '22px',
            color: '#27ae60',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        title.setOrigin(0.5);
        detailPanel.add(title);
        
        // 详细信息
        let detailY = panelY + 60;
        const details: Array<{label: string, value: string, color: string}> = [
            { label: '类型', value: this.getItemTypeLabel(item.type), color: '#3498db' },
            { label: '价格', value: `$${item.price}`, color: item.price > item.basePrice ? '#e74c3c' : '#2ecc71' },
            { label: '库存', value: `${item.stock}`, color: item.stock > 0 ? '#2ecc71' : '#e74c3c' },
            { label: '描述', value: item.description, color: '#95a5a6' }
        ];
        
        if (item.damage) {
            details.splice(2, 0, { label: '伤害', value: `${item.damage}`, color: '#e74c3c' });
        }
        if (item.armorValue) {
            details.splice(2, 0, { label: '护甲值', value: `${item.armorValue}`, color: '#3498db' });
        }
        if (item.healAmount) {
            details.splice(2, 0, { label: '治疗量', value: `${item.healAmount} HP`, color: '#2ecc71' });
        }
        
        details.forEach(detail => {
            const labelText = this.add.text(panelX + 20, detailY, `${detail.label}:`, {
                fontSize: '14px',
                color: '#bdc3c7',
                stroke: '#000000',
                strokeThickness: 2
            });
            detailPanel.add(labelText);
            
            const valueText = this.add.text(panelX + panelWidth - 20, detailY, detail.value, {
                fontSize: '14px',
                color: detail.color,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            valueText.setOrigin(1, 0);
            detailPanel.add(valueText);
            
            detailY += 25;
        });
        
        // 购买按钮
        const canAfford = this.playerMoney >= item.price && item.stock > 0;
        const buyButtonBg = this.add.graphics();
        buyButtonBg.fillStyle(canAfford ? 0x27ae60 : 0x7f8c8d, 0.9);
        buyButtonBg.fillRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
        buyButtonBg.lineStyle(2, canAfford ? 0x2ecc71 : 0x7f8c8d, 1);
        buyButtonBg.strokeRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
        detailPanel.add(buyButtonBg);
        
        const buyButtonText = this.add.text(
            panelX + panelWidth / 2,
            panelY + panelHeight - 32,
            canAfford ? `💲 购买 ($${item.price})` : (this.playerMoney < item.price ? '💰 金钱不足' : '已售罄'),
            {
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        buyButtonText.setOrigin(0.5);
        if (canAfford) {
            buyButtonText.setInteractive({ useHandCursor: true });
            
            buyButtonText.on('pointerover', () => {
                buyButtonBg.clear();
                buyButtonBg.fillStyle(0x2ecc71, 1);
                buyButtonBg.fillRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
                buyButtonBg.lineStyle(2, 0x27ae60, 1);
                buyButtonBg.strokeRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
            });
            
            buyButtonText.on('pointerout', () => {
                buyButtonBg.clear();
                buyButtonBg.fillStyle(0x27ae60, 0.9);
                buyButtonBg.fillRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
                buyButtonBg.lineStyle(2, 0x2ecc71, 1);
                buyButtonBg.strokeRoundedRect(panelX + 20, panelY + panelHeight - 50, panelWidth - 40, 35, 8);
            });
            
            buyButtonText.on('pointerdown', () => {
                this.buyItem(item);
            });
        }
        detailPanel.add(buyButtonText);
        
        this.shopItemDetailPanel = detailPanel;
    }

    private sellItem(item: WarehouseItem, index: number) {
        const sellValue = item.value * item.quantity;
        this.playerMoney += sellValue;
        
        // 从仓库移除
        this.warehouseItems.splice(index, 1);
        
        // 保存数据
        localStorage.setItem('game_inventory', JSON.stringify(this.warehouseItems));
        localStorage.setItem('player_money', this.playerMoney.toString());
        
        // 更新显示
        this.moneyText.setText(`💰 金钱: $${this.playerMoney}`);
        
        // 显示消息
        this.showMessage(`成功出售 ${item.name} x${item.quantity}，获得 $${sellValue}`, '#2ecc71');
        
        // 刷新界面
        this.scene.restart({ playerMoney: this.playerMoney });
    }

    private buyItem(item: ShopItem) {
        if (this.playerMoney >= item.price && item.stock > 0) {
            this.playerMoney -= item.price;
            item.stock--;
            
            // 保存到仓库
            this.saveToWarehouse(item);
            
            // 更新显示
            this.moneyText.setText(`💰 金钱: $${this.playerMoney}`);
            if ((item as any).stockText) {
                (item as any).stockText.setText(`库存: ${item.stock}`);
                if (item.stock === 0) {
                    (item as any).stockText.setColor('#e74c3c');
                }
            }
            
            // 保存数据
            localStorage.setItem('player_money', this.playerMoney.toString());
            
            // 显示消息
            this.showMessage(`成功购买 ${item.name}！`, '#2ecc71');
            
            // 更新详情面板
            if (this.shopItemDetailPanel) {
                this.shopItemDetailPanel.destroy();
                this.shopItemDetailPanel = null;
                this.showShopItemDetails(item);
            }
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
            const existingItem = inventory.find(i => i.name === item.name && i.type === item.type.toUpperCase());
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + 1;
            } else {
                inventory.push({
                    id: Date.now(),
                    type: item.type.toUpperCase(),
                    name: item.name,
                    value: item.basePrice,
                    quantity: 1,
                    description: item.description,
                    subtype: item.subtype,
                    rarity: item.rarity
                });
            }
            
            localStorage.setItem('game_inventory', JSON.stringify(inventory));
        } catch (error) {
            console.error('保存到仓库失败:', error);
        }
    }

    private startPriceFluctuation() {
        // 每60秒更新一次价格
        this.time.addEvent({
            delay: 60000,
            callback: this.updatePrices,
            callbackScope: this,
            loop: true
        });
    }

    private updatePrices() {
        this.shopItems.forEach(item => {
            // 价格波动范围：±15%
            const fluctuation = (Math.random() - 0.5) * 0.3; // -0.15 到 +0.15
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
        
        const buttonY = height - 60;
        const buttonWidth = 180;
        const buttonHeight = 45;
        
        // 返回菜单按钮
        const returnMenuButton = this.add.rectangle(
            width / 2 - 100,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x95a5a6,
            0.85
        );
        returnMenuButton.setStrokeStyle(3, 0x95a5a6);
        returnMenuButton.setInteractive({ useHandCursor: true });
        returnMenuButton.setDepth(2000);
        
        const returnMenuText = this.add.text(
            width / 2 - 100,
            buttonY,
            '⬅️ 返回菜单',
            { 
                font: 'bold 18px Arial', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        returnMenuText.setOrigin(0.5);
        returnMenuText.setDepth(2001);
        
        returnMenuButton.on('pointerover', () => {
            returnMenuButton.setFillStyle(0x95a5a6, 1);
            returnMenuButton.setScale(1.05);
            returnMenuText.setScale(1.05);
        });
        
        returnMenuButton.on('pointerout', () => {
            returnMenuButton.setFillStyle(0x95a5a6, 0.85);
            returnMenuButton.setScale(1);
            returnMenuText.setScale(1);
        });
        
        returnMenuButton.on('pointerdown', () => {
            this.scene.start('MenuScene', { playerMoney: this.playerMoney });
        });
        
        // 返回游戏按钮
        const returnGameButton = this.add.rectangle(
            width / 2 + 100,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x27ae60,
            0.85
        );
        returnGameButton.setStrokeStyle(3, 0x27ae60);
        returnGameButton.setInteractive({ useHandCursor: true });
        returnGameButton.setDepth(2000);
        
        const returnGameText = this.add.text(
            width / 2 + 100,
            buttonY,
            '🎮 返回游戏',
            { 
                font: 'bold 18px Arial', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        returnGameText.setOrigin(0.5);
        returnGameText.setDepth(2001);
        
        returnGameButton.on('pointerover', () => {
            returnGameButton.setFillStyle(0x27ae60, 1);
            returnGameButton.setScale(1.05);
            returnGameText.setScale(1.05);
        });
        
        returnGameButton.on('pointerout', () => {
            returnGameButton.setFillStyle(0x27ae60, 0.85);
            returnGameButton.setScale(1);
            returnGameText.setScale(1);
        });
        
        returnGameButton.on('pointerdown', () => {
            try {
                localStorage.setItem('player_money', this.playerMoney.toString());
            } catch (error) {
                console.warn('保存金钱数据失败:', error);
            }
            
            const gameScene = this.scene.get('GameScene');
            if (gameScene && gameScene.scene.isActive()) {
                this.scene.stop();
                this.scene.resume('GameScene');
            } else {
                this.scene.start('MenuScene', { playerMoney: this.playerMoney });
            }
        });
    }

    private showMessage(message: string, color: string) {
        const msgText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.height * 0.85,
            message,
            {
                font: '20px Arial',
                color: color,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 20, y: 10 },
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        msgText.setOrigin(0.5);
        msgText.setDepth(3000);
        
        this.tweens.add({
            targets: msgText,
            alpha: { from: 1, to: 0 },
            duration: 2500,
            onComplete: () => msgText.destroy()
        });
    }

    private getRarityColor(rarity: string): number {
        switch (rarity) {
            case 'common': return 0x2c3e50; // 灰色
            case 'uncommon': return 0x2ecc71; // 绿色
            case 'rare': return 0x3498db; // 蓝色
            case 'epic': return 0x9b59b6; // 紫色
            case 'legendary': return 0xf39c12; // 金色
            default: return 0x2c3e50;
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
}

export default ShopScene;
