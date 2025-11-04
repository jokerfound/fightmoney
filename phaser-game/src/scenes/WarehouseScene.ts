import { GameConstants } from '../config/gameConfig';

// 物品接口
export interface InventoryItem {
    id: number;
    type: string;
    name: string;
    value: number;
    quantity: number;
    description: string;
}

export class WarehouseScene extends Phaser.Scene {
    private inventoryText!: Phaser.GameObjects.Text;
    private itemSlots: Phaser.GameObjects.Graphics[] = [];
    private selectedSlot: number = -1;
    private inventoryItems: InventoryItem[] = [];
    private playerHealth: number = 0;
    private playerMoney: number = 0;
    private totalValue: number = 0;
    private maxCapacity: number = 12; // 最大容量
    private upgradeLevel: number = 1; // 升级等级
    private upgradeCost: number = 1000; // 升级费用
    
    // 详细信息面板相关属性
    private detailsPanel: Phaser.GameObjects.Rectangle | null = null;
    private detailsTitle: Phaser.GameObjects.Text | null = null;
    private detailsText: Phaser.GameObjects.Text | null = null;
    private useButton: Phaser.GameObjects.Rectangle | null = null;

    constructor() {
        super({ key: 'WarehouseScene' });
    }

    init(data: any) {
        this.playerHealth = data.playerHealth || 100;
        this.playerMoney = data.playerMoney || 0;
        
        // 从本地存储加载库存
        this.loadInventoryFromStorage();
        
        // 如果没有库存数据，创建示例数据
        if (this.inventoryItems.length === 0) {
            this.createSampleInventory();
        }
        
        this.calculateTotalValue();
    }

    create() {
        console.log('仓库场景创建完成');
        
        this.createBackground();
        this.createInventoryUI();
        this.createItemSlots();
        this.createActionButtons();
        this.createStatsDisplay();
        this.createControlsInfo();
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
        titleBg.lineStyle(3, 0x3498db, 0.8);
        titleBg.strokeRoundedRect(width * 0.05, height * 0.03, width * 0.9, 70, 10);
        
        // 标题
        const title = this.add.text(
            width / 2,
            height * 0.03 + 35,
            '🏪 仓库管理',
            { 
                font: 'bold 36px Arial', 
                color: '#ecf0f1',
                stroke: '#2c3e50',
                strokeThickness: 4
            }
        );
        title.setOrigin(0.5);
        
        // 副标题
        const subtitle = this.add.text(
            width / 2,
            height * 0.03 + 65,
            '📦 管理你的物品和装备',
            { 
                font: '18px Arial', 
                color: '#95a5a6'
            }
        );
        subtitle.setOrigin(0.5, 0);
    }

    private createInventoryUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 库存区域背景
        const inventoryBg = this.add.graphics();
        const inventoryWidth = width * 0.88;
        const inventoryHeight = height * 0.55;
        const inventoryX = (width - inventoryWidth) / 2;
        const inventoryY = height * 0.12;
        
        inventoryBg.fillStyle(0x34495e, 0.9);
        inventoryBg.fillRoundedRect(inventoryX, inventoryY, inventoryWidth, inventoryHeight, 12);
        inventoryBg.lineStyle(3, 0x3498db);
        inventoryBg.strokeRoundedRect(inventoryX, inventoryY, inventoryWidth, inventoryHeight, 12);
        
        // 库存标题
        this.inventoryText = this.add.text(
            width / 2,
            inventoryY + 25,
            '📦 物品仓库',
            { 
                font: 'bold 28px Arial', 
                color: '#ecf0f1',
                stroke: '#2c3e50',
                strokeThickness: 3
            }
        );
        this.inventoryText.setOrigin(0.5);
    }

    private createItemSlots() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 从本地存储加载容量和升级信息
        this.loadWarehouseData();
        
        const slotsPerRow = 6;
        const slotSize = 85;
        const slotSpacing = 12;
        
        const inventoryWidth = width * 0.88;
        const inventoryX = (width - inventoryWidth) / 2;
        const inventoryY = height * 0.12;
        
        const totalSlotWidth = slotsPerRow * slotSize + (slotsPerRow - 1) * slotSpacing;
        const startX = inventoryX + (inventoryWidth - totalSlotWidth) / 2;
        const startY = inventoryY + 70;
        
        for (let i = 0; i < this.maxCapacity; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            // 创建物品槽
            const slot = this.add.graphics();
            slot.fillStyle(0x2c3e50, 0.8);
            slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
            slot.lineStyle(2, 0x3498db, 0.6);
            slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            slot.setInteractive(new Phaser.Geom.Rectangle(x, y, slotSize, slotSize), Phaser.Geom.Rectangle.Contains);
            
            this.itemSlots.push(slot);
            
            // 槽位交互效果
            slot.on('pointerover', () => {
                slot.clear();
                slot.fillStyle(0x2c3e50, 0.8);
                slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                slot.lineStyle(3, 0xf39c12);
                slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            });
            
            slot.on('pointerout', () => {
                slot.clear();
                slot.fillStyle(0x2c3e50, 0.8);
                slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
                slot.lineStyle(2, 0x3498db, 0.6);
                slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            });
            
            slot.on('pointerdown', () => {
                this.selectSlot(i);
            });
            
            // 如果槽位有物品，显示物品
            if (i < this.inventoryItems.length) {
                this.createItemInSlot(i, x + slotSize / 2, y + slotSize / 2);
            }
        }
    }

    private createItemInSlot(slotIndex: number, x: number, y: number) {
        if (slotIndex >= this.inventoryItems.length) return;
        
        const item = this.inventoryItems[slotIndex];
        
        // 创建物品容器，位置设为(0, 0)，所有元素相对于容器定位
        const itemContainer = this.add.container(x, y);
        
        // 创建物品图标 - 现代化设计
        const itemIcon = this.add.graphics();
        itemIcon.fillStyle(this.getItemColor(item.type));
        itemIcon.fillCircle(0, 0, 30);
        itemIcon.lineStyle(2, 0xecf0f1);
        itemIcon.strokeCircle(0, 0, 30);
        
        // 物品名称
        const itemText = this.add.text(0, -20, item.name, 
            { 
                font: 'bold 12px Arial', 
                color: '#ffffff',
                stroke: '#2c3e50',
                strokeThickness: 2
            });
        itemText.setOrigin(0.5);
        
        // 物品数量
        const quantityText = this.add.text(0, 5, `${item.quantity}`, 
            { 
                font: 'bold 16px Arial', 
                color: '#f39c12',
                stroke: '#2c3e50',
                strokeThickness: 2
            });
        quantityText.setOrigin(0.5);
        
        // 物品价值
        const valueText = this.add.text(0, 25, `$${item.value}`, 
            { 
                font: 'bold 12px Arial', 
                color: '#2ecc71',
                stroke: '#2c3e50',
                strokeThickness: 1
            });
        valueText.setOrigin(0.5);
        
        // 将所有元素添加到容器中
        itemContainer.add([itemIcon, itemText, quantityText, valueText]);
        itemContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
        
        let tooltip: Phaser.GameObjects.Text | null = null;
        
        itemContainer.on('pointerover', () => {
            // 显示悬停提示
            tooltip = this.add.text(
                x + 50, 
                y - 20, 
                `📦 ${item.name}\n🏷️ 类型: ${this.getItemTypeName(item.type)}\n💰 价值: $${item.value}\n🔢 数量: ${item.quantity}`,
                { 
                    font: 'bold 14px Arial', 
                    color: '#ecf0f1',
                    stroke: '#2c3e50',
                    strokeThickness: 2,
                    backgroundColor: '#34495e',
                    padding: { x: 12, y: 8 }
                }
            );
            tooltip.setOrigin(0, 0.5);
            
            // 显示详细信息面板
            this.showItemDetails(item);
        });
        
        itemContainer.on('pointerout', () => {
            // 隐藏悬停提示
            if (tooltip) {
                tooltip.destroy();
                tooltip = null;
            }
            
            // 隐藏详细信息面板
            this.hideItemDetails();
        });
        
        // 点击显示详细信息
        itemContainer.on('pointerdown', () => {
            this.selectSlot(slotIndex);
        });
    }
    
    private loadInventoryFromStorage() {
        try {
            const savedInventory = localStorage.getItem('game_inventory');
            if (savedInventory) {
                this.inventoryItems = JSON.parse(savedInventory);
            }
        } catch (error) {
            console.warn('无法加载库存数据:', error);
            this.inventoryItems = [];
        }
    }
    
    private saveInventoryToStorage() {
        try {
            localStorage.setItem('game_inventory', JSON.stringify(this.inventoryItems));
        } catch (error) {
            console.warn('无法保存库存数据:', error);
        }
    }
    
    private createSampleInventory() {
        // 创建示例库存物品
        this.inventoryItems = [
            {
                id: 1,
                type: 'WEAPON',
                name: '手枪',
                value: 500,
                quantity: 1,
                description: '基础自卫武器'
            },
            {
                id: 2,
                type: 'AMMO',
                name: '9mm子弹',
                value: 100,
                quantity: 30,
                description: '手枪弹药'
            },
            {
                id: 3,
                type: 'ARMOR',
                name: '防弹背心',
                value: 300,
                quantity: 1,
                description: '提供基础防护'
            },
            {
                id: 4,
                type: 'MEDICAL',
                name: '急救包',
                value: 200,
                quantity: 2,
                description: '恢复生命值'
            },
            {
                id: 5,
                type: 'FOOD',
                name: '罐头',
                value: 50,
                quantity: 5,
                description: '基础食物补给'
            },
            {
                id: 6,
                type: 'VALUABLE',
                name: '金条',
                value: 1000,
                quantity: 1,
                description: '贵重物品'
            }
        ];
        
        this.saveInventoryToStorage();
    }
    
    private calculateTotalValue() {
        this.totalValue = this.inventoryItems.reduce((total, item) => {
            return total + (item.value * item.quantity);
        }, 0);
    }

    private createActionButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const centerX = width / 2;
        const buttonY = height * 0.75;
        const buttonWidth = 160;
        const buttonHeight = 45;
        const buttonMargin = 15;
        
        const totalButtonsWidth = 4 * buttonWidth + 3 * buttonMargin;
        const startX = (width - totalButtonsWidth) / 2;
        
        const buttons = [
            { text: '💰 出售物品', x: startX + buttonWidth/2, action: () => this.sellSelectedItem(), color: 0xe74c3c },
            { text: '📦 整理物品', x: startX + buttonWidth + buttonMargin + buttonWidth/2, action: () => this.organizeItems(), color: 0x3498db },
            { text: `🔼 升级(${this.upgradeCost}$)`, x: startX + 2*(buttonWidth + buttonMargin) + buttonWidth/2, action: () => this.upgradeWarehouse(), color: 0xf39c12 },
            { text: '⬅️ 返回菜单', x: startX + 3*(buttonWidth + buttonMargin) + buttonWidth/2, action: () => this.returnToMenu(), color: 0x95a5a6 }
        ];
        
        buttons.forEach(button => {
            const bg = this.add.rectangle(button.x, buttonY, buttonWidth, buttonHeight, button.color, 0.85);
            bg.setStrokeStyle(3, button.color);
            bg.setInteractive({ useHandCursor: true });
            
            const text = this.add.text(button.x, buttonY, button.text, 
                { 
                    font: 'bold 16px Arial', 
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                });
            text.setOrigin(0.5);
            
            bg.on('pointerover', () => {
                bg.setFillStyle(button.color, 1);
                bg.setScale(1.05);
                text.setScale(1.05);
            });
            
            bg.on('pointerout', () => {
                bg.setFillStyle(button.color, 0.85);
                bg.setScale(1);
                text.setScale(1);
            });
            
            bg.on('pointerdown', button.action);
        });
    }

    private createStatsDisplay() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 统计信息区域
        const statsX = width * 0.06;
        const statsY = height * 0.82;
        const statsWidth = width * 0.88;
        
        // 背景面板
        const statsBg = this.add.graphics();
        statsBg.fillStyle(0x2c3e50, 0.85);
        statsBg.fillRoundedRect(statsX, statsY, statsWidth, 60, 8);
        statsBg.lineStyle(2, 0x3498db, 0.6);
        statsBg.strokeRoundedRect(statsX, statsY, statsWidth, 60, 8);
        
        // 确保血量不会显示为0
        const displayHealth = this.playerHealth > 0 ? this.playerHealth : 100;
        
        // 统计信息
        const stats = [
            { label: '❤️ 生命值', value: `${displayHealth}`, color: '#e74c3c' },
            { label: '💰 金钱', value: `$${this.playerMoney}`, color: '#f1c40f' },
            { label: '📦 物品数', value: `${this.inventoryItems.length}/${this.maxCapacity}`, color: '#3498db' },
            { label: '💵 总价值', value: `$${this.totalValue}`, color: '#2ecc71' },
            { label: '🏪 仓库等级', value: `Lv.${this.upgradeLevel}`, color: '#9b59b6' }
        ];
        
        const itemWidth = statsWidth / stats.length;
        
        stats.forEach((stat, index) => {
            const x = statsX + index * itemWidth + itemWidth / 2;
            const y = statsY + 30;
            
            const text = this.add.text(x, y, 
                `${stat.label}\n${stat.value}`,
                { 
                    font: 'bold 14px Arial', 
                    color: stat.color,
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 2
                }
            );
            text.setOrigin(0.5);
        });
    }
    
    private loadWarehouseData() {
        try {
            const savedCapacity = localStorage.getItem('warehouse_capacity');
            const savedLevel = localStorage.getItem('warehouse_level');
            
            if (savedCapacity) {
                this.maxCapacity = parseInt(savedCapacity, 10);
            }
            if (savedLevel) {
                this.upgradeLevel = parseInt(savedLevel, 10);
                this.upgradeCost = 1000 * Math.pow(2, this.upgradeLevel - 1); // 每次升级费用翻倍
            }
        } catch (error) {
            console.warn('加载仓库数据失败:', error);
        }
    }
    
    private saveWarehouseData() {
        try {
            localStorage.setItem('warehouse_capacity', this.maxCapacity.toString());
            localStorage.setItem('warehouse_level', this.upgradeLevel.toString());
        } catch (error) {
            console.warn('保存仓库数据失败:', error);
        }
    }
    
    private upgradeWarehouse() {
        if (this.playerMoney >= this.upgradeCost) {
            this.playerMoney -= this.upgradeCost;
            this.upgradeLevel++;
            this.maxCapacity += 6; // 每次升级增加6个槽位
            this.upgradeCost = 1000 * Math.pow(2, this.upgradeLevel - 1);
            
            this.saveWarehouseData();
            this.showMessage(`仓库升级成功！当前等级: ${this.upgradeLevel}，容量: ${this.maxCapacity}`);
            
            // 刷新界面
            this.scene.restart({ 
                playerHealth: this.playerHealth, 
                playerMoney: this.playerMoney 
            });
        } else {
            this.showMessage(`金钱不足！需要 $${this.upgradeCost}`);
        }
    }

    private createControlsInfo() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 操作说明 - 使用动态位置
        const controlsText = this.add.text(
            width * 0.1, // 左侧位置
            height * 0.15 + 20, // 与库存区域对齐
            '操作说明: 点击物品槽选择物品 | 数字键1-12快速选择 | ESC返回游戏',
            { font: '12px Arial', color: '#bdc3c7' }
        );
        controlsText.setOrigin(0, 0); // 左对齐
        
        // 键盘控制
        this.input.keyboard!.on('keydown-ESC', () => {
            this.returnToGame();
        });
        
        // 数字键快速选择
        for (let i = 0; i < 12; i++) {
            this.input.keyboard!.on(`keydown-${i + 1}`, () => {
                if (i < this.itemSlots.length) {
                    this.selectSlot(i);
                }
            });
        }
    }

    private selectSlot(slotIndex: number) {
        // 取消之前的选择
        if (this.selectedSlot >= 0) {
            // 重新绘制之前选中的槽位边框
            this.redrawSlot(this.selectedSlot, 0x3498db, 2);
        }
        
        // 选择新槽位
        this.selectedSlot = slotIndex;
        // 重新绘制新选中的槽位边框
        this.redrawSlot(slotIndex, 0xf1c40f, 4);
        
        console.log(`选中槽位 ${slotIndex + 1}`);
    }
    
    private redrawSlot(slotIndex: number, color: number, lineWidth: number) {
        const slotSize = 90;
        const slotMargin = 15;
        const slotsPerRow = 6;
        
        // 使用与createItemSlots相同的库存区域中央对齐计算
        const inventoryAreaWidth = 720;
        const inventoryAreaStartX = 40;
        const totalWidth = slotsPerRow * slotSize + (slotsPerRow - 1) * slotMargin;
        const startX = inventoryAreaStartX + Math.floor((inventoryAreaWidth - totalWidth) / 2);
        const startY = 150;
        
        const row = Math.floor(slotIndex / slotsPerRow);
        const col = slotIndex % slotsPerRow;
        
        const x = startX + col * (slotSize + slotMargin) + slotSize / 2;
        const y = startY + row * (slotSize + slotMargin) + slotSize / 2;
        
        // 使用Graphics对象来绘制槽位，而不是Rectangle对象
        const graphics = this.add.graphics();
        // 不需要在新创建的graphics对象上调用clear()
        graphics.fillStyle(0x34495e);
        graphics.fillRect(Math.floor(x - slotSize/2), Math.floor(y - slotSize/2), slotSize, slotSize);
        graphics.lineStyle(lineWidth, color);
        graphics.strokeRect(Math.floor(x - slotSize/2), Math.floor(y - slotSize/2), slotSize, slotSize);
    }

    private sellSelectedItem() {
        if (this.selectedSlot >= 0 && this.selectedSlot < this.inventoryItems.length) {
            const item = this.inventoryItems[this.selectedSlot];
            if (!item) return;
            const sellValue = item.value * item.quantity;
            
            // 增加玩家金钱
            this.playerMoney += sellValue;
            
            // 显示出售信息
            this.showMessage(`成功出售 ${item.name} x${item.quantity}，获得 $${sellValue}`);
            
            // 从库存中移除物品
            this.inventoryItems.splice(this.selectedSlot, 1);
            
            // 保存库存数据
            this.saveInventoryToStorage();
            
            // 重新计算总价值
            this.calculateTotalValue();
            
            // 重置选择
            this.selectedSlot = -1;
            
            // 刷新界面
            this.scene.restart({ 
                playerHealth: this.playerHealth, 
                playerMoney: this.playerMoney 
            });
        } else {
            this.showMessage('请先选择一个有效的物品槽位');
        }
    }

    private organizeItems() {
        // 按物品类型和价值排序
        this.inventoryItems.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            return b.value - a.value;
        });
        
        // 保存整理后的库存
        this.saveInventoryToStorage();
        
        this.showMessage('库存已按类型和价值排序整理完成');
        
        // 刷新界面
        this.scene.restart({ 
            playerHealth: this.playerHealth, 
            playerMoney: this.playerMoney 
        });
    }

    private returnToGame() {
        try {
            // 先保存库存数据
            this.saveInventoryToStorage();
            
            // 先获取GameScene的引用并更新数据
            const gameScene = this.scene.get('GameScene') as any;
            if (gameScene) {
                // 更新GameScene中的玩家数据
                gameScene.playerMoney = this.playerMoney;
                gameScene.playerHealth = this.playerHealth;
            }
            
            // 停止当前场景
            this.scene.stop();
            
            // 恢复GameScene
            this.scene.resume('GameScene');
            
            console.log('成功返回游戏场景');
        } catch (error) {
            console.error('返回游戏场景时出错:', error);
            // 即使出错，也要确保回到GameScene
            try {
                this.scene.stop();
                this.scene.resume('GameScene');
            } catch (innerError) {
                console.error('恢复场景时发生二次错误:', innerError);
            }
        }
    }
    
    private returnToMenu() {
        try {
            // 保存库存数据
            this.saveInventoryToStorage();
            
            // 停止当前场景
            this.scene.stop();
            
            // 启动主菜单
            this.scene.start('MenuScene');
            
            console.log('返回主菜单');
        } catch (error) {
            console.error('返回主菜单时出错:', error);
        }
    }

    private getItemColor(itemType: string): number {
        switch (itemType) {
            case 'WEAPON': return 0xe74c3c; // 红色
            case 'AMMO': return 0xf39c12;   // 橙色
            case 'ARMOR': return 0x3498db;  // 蓝色
            case 'MEDICAL': return 0x2ecc71; // 绿色
            case 'FOOD': return 0x9b59b6;   // 紫色
            case 'VALUABLE': return 0xf1c40f; // 黄色
            default: return 0x95a5a6;      // 灰色
        }
    }
    
    private getItemTypeName(itemType: string): string {
        switch (itemType) {
            case 'WEAPON': return '武器';
            case 'AMMO': return '弹药';
            case 'ARMOR': return '护甲';
            case 'MEDICAL': return '医疗';
            case 'FOOD': return '食物';
            case 'VALUABLE': return '贵重物品';
            default: return '其他';
        }
    }
    
    private showItemDetails(item: InventoryItem) {
        // 隐藏之前的详细信息面板
        this.hideItemDetails();
        
        // 创建详细信息面板背景
        this.detailsPanel = this.add.rectangle(650, 200, 280, 200, 0x2c3e50);
        this.detailsPanel.setStrokeStyle(2, 0xecf0f1);
        
        // 物品标题
        this.detailsTitle = this.add.text(650, 120, '物品详细信息', 
            { font: '18px Arial', color: '#f1c40f', stroke: '#2c3e50', strokeThickness: 1 });
        this.detailsTitle.setOrigin(0.5);
        
        // 物品详细信息
        const detailsText = [
            `名称: ${item.name}`,
            `类型: ${this.getItemTypeName(item.type)}`,
            `价值: $${item.value}`,
            `数量: ${item.quantity}`,
            `描述: ${item.description}`,
            `ID: ${item.id}`
        ].join('\n');
        
        this.detailsText = this.add.text(520, 150, detailsText, 
            { font: '14px Arial', color: '#ecf0f1', wordWrap: { width: 250 } });
        
        // 添加使用按钮（如果物品可使用）
        if (item.type === 'MEDICAL' || item.type === 'FOOD') {
            this.useButton = this.add.rectangle(650, 280, 120, 30, 0x27ae60);
            this.useButton.setInteractive();
            
            const useText = this.add.text(650, 280, '使用物品', 
                { font: '14px Arial', color: '#ffffff' });
            useText.setOrigin(0.5);
            
            this.useButton.on('pointerdown', () => {
                this.useItem(item);
            });
            
            this.useButton.on('pointerover', () => {
                if (this.useButton) this.useButton.setFillStyle(0x2ecc71);
            });
            
            this.useButton.on('pointerout', () => {
                if (this.useButton) this.useButton.setFillStyle(0x27ae60);
            });
        }
    }
    
    private hideItemDetails() {
        if (this.detailsPanel) {
            this.detailsPanel.destroy();
            this.detailsPanel = null;
        }
        if (this.detailsTitle) {
            this.detailsTitle.destroy();
            this.detailsTitle = null;
        }
        if (this.detailsText) {
            this.detailsText.destroy();
            this.detailsText = null;
        }
        if (this.useButton) {
            this.useButton.destroy();
            this.useButton = null;
        }
    }
    
    private useItem(item: InventoryItem) {
        if (item.type === 'MEDICAL') {
            // 使用医疗物品
            this.playerHealth = Math.min(GameConstants.PLAYER.HEALTH, this.playerHealth + 30);
            this.showMessage(`使用 ${item.name}，生命值恢复30点`);
        } else if (item.type === 'FOOD') {
            // 使用食物
            this.playerHealth = Math.min(GameConstants.PLAYER.HEALTH, this.playerHealth + 10);
            this.showMessage(`使用 ${item.name}，生命值恢复10点`);
        }
        
        // 减少物品数量
        item.quantity--;
        
        // 如果物品数量为0，从库存中移除
        if (item.quantity <= 0) {
            const index = this.inventoryItems.indexOf(item);
            if (index > -1) {
                this.inventoryItems.splice(index, 1);
            }
        }
        
        // 保存库存数据
        this.saveInventoryToStorage();
        
        // 重新计算总价值
        this.calculateTotalValue();
        
        // 刷新界面
        this.scene.restart({ 
            playerHealth: this.playerHealth, 
            playerMoney: this.playerMoney 
        });
    }
    
    private showMessage(message: string) {
        // 创建消息文本
        const messageText = this.add.text(
            this.cameras.main.centerX,
            520,
            message,
            { 
                font: '16px Arial', 
                color: '#f39c12',
                stroke: '#2c3e50',
                strokeThickness: 2
            }
        );
        messageText.setOrigin(0.5);
        
        // 3秒后自动消失
        this.time.delayedCall(3000, () => {
            messageText.destroy();
        });
    }
    
    update() {
        // 仓库场景不需要每帧更新
    }
}

export default WarehouseScene;