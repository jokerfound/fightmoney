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
    
    // 背包相关属性
    private backpackItems: InventoryItem[] = [];
    private backpackSlots: Phaser.GameObjects.Graphics[] = [];
    // private selectedBackpackSlot: number = -1; // 未使用
    private fromEvacuation: boolean = false; // 是否从撤离进入
    
    // 详细信息面板相关属性（未使用）
    // private detailsPanel: Phaser.GameObjects.Rectangle | null = null;
    // private detailsTitle: Phaser.GameObjects.Text | null = null;
    // private detailsText: Phaser.GameObjects.Text | null = null;
    // private useButton: Phaser.GameObjects.Rectangle | null = null;
    
    // 操作菜单相关属性
    private actionMenu: Phaser.GameObjects.Container | null = null;
    private currentSelectedItem: { item: InventoryItem, isBackpack: boolean, slotIndex: number } | null = null;

    constructor() {
        super({ key: 'WarehouseScene' });
    }

    init(data: any) {
        // 优先从本地存储加载玩家数据（确保金钱数据持续保留）
        this.loadPlayerData();
        
        // 如果传入的数据不为空且大于本地存储的值，使用传入的数据（合并而不是覆盖）
        // 这样可以确保金钱只会增加，不会减少
        if (data.playerHealth !== undefined && data.playerHealth > 0) {
            this.playerHealth = Math.max(this.playerHealth, data.playerHealth);
        }
        if (data.playerMoney !== undefined) {
            // 取较大值，确保金钱不会因为重新进入而减少
            this.playerMoney = Math.max(this.playerMoney, data.playerMoney);
            // 立即保存，确保金钱数据持久化
            localStorage.setItem('player_money', this.playerMoney.toString());
        }
        
        this.fromEvacuation = data.fromEvacuation || false;
        
        // 从本地存储加载库存（仓库物品会一直保存）
        this.loadInventoryFromStorage();
        
        // 如果有背包物品数据（从撤离进入），添加到背包
        if (data.backpackItems && Array.isArray(data.backpackItems)) {
            this.backpackItems = data.backpackItems;
        }
        
        // 如果没有库存数据且不是从撤离进入，创建示例数据
        if (this.inventoryItems.length === 0 && !this.fromEvacuation) {
            this.createSampleInventory();
        }
        
        this.calculateTotalValue();
        
        console.log(`仓库场景初始化: 金钱=$${this.playerMoney}, 血量=${this.playerHealth}, 仓库物品=${this.inventoryItems.length}, 背包物品=${this.backpackItems.length}`);
    }
    
    // 加载玩家数据
    private loadPlayerData() {
        try {
            const savedMoney = localStorage.getItem('player_money');
            const savedHealth = localStorage.getItem('player_health');
            
            if (savedMoney) {
                this.playerMoney = parseInt(savedMoney, 10);
            }
            if (savedHealth) {
                this.playerHealth = parseInt(savedHealth, 10);
            }
        } catch (error) {
            console.warn('无法加载玩家数据:', error);
        }
    }

    create() {
        console.log('仓库场景创建完成');
        
        // 显示鼠标光标
        this.input.setDefaultCursor('default');
        
        this.createBackground();
        this.createInventoryUI();
        this.createItemSlots();
        this.createBackpackUI();
        this.createActionButtons();
        this.createStatsDisplay();
        this.createControlsInfo();
        this.createReturnToMenuButton();
        
        // 如果是从撤离进入，显示欢迎消息
        if (this.fromEvacuation) {
            this.showMessage('🎉 撤离成功！请将背包物品转移到仓库');
        }
        
        // 确保数据已保存
        this.saveInventoryToStorage();
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
        
        // 仓库区域背景（右侧）
        const inventoryBg = this.add.graphics();
        const inventoryWidth = width * 0.45; // 占屏幕45%宽度
        const inventoryHeight = height * 0.65;
        const inventoryX = width * 0.52; // 右侧位置
        const inventoryY = height * 0.15;
        
        inventoryBg.fillStyle(0x34495e, 0.9);
        inventoryBg.fillRoundedRect(inventoryX, inventoryY, inventoryWidth, inventoryHeight, 12);
        inventoryBg.lineStyle(3, 0x3498db);
        inventoryBg.strokeRoundedRect(inventoryX, inventoryY, inventoryWidth, inventoryHeight, 12);
        
        // 仓库标题
        this.inventoryText = this.add.text(
            inventoryX + inventoryWidth / 2,
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
        
        const slotsPerRow = 4; // 每行4个槽位
        const slotSize = 80;
        const slotSpacing = 10;
        
        const inventoryWidth = width * 0.45;
        const inventoryX = width * 0.52;
        const inventoryY = height * 0.15;
        
        const totalSlotWidth = slotsPerRow * slotSize + (slotsPerRow - 1) * slotSpacing;
        const startX = inventoryX + (inventoryWidth - totalSlotWidth) / 2;
        const startY = inventoryY + 70;
        
        for (let i = 0; i < this.maxCapacity; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            // 创建物品槽背景
            const slot = this.add.graphics();
            slot.fillStyle(0x2c3e50, 0.8);
            slot.fillRoundedRect(x, y, slotSize, slotSize, 8);
            slot.lineStyle(2, 0x3498db, 0.6);
            slot.strokeRoundedRect(x, y, slotSize, slotSize, 8);
            slot.setDepth(50);
            
            this.itemSlots.push(slot);
            
            // 创建物品（如果该槽位有物品）
            if (i < this.inventoryItems.length) {
                this.createItemInSlot(i, x + slotSize / 2, y + slotSize / 2);
            }
        }
    }

    private createItemInSlot(slotIndex: number, x: number, y: number) {
        if (slotIndex >= this.inventoryItems.length) return;
        
        const item = this.inventoryItems[slotIndex];
        
        // 创建物品容器
        const itemContainer = this.add.container(x, y);
        
        // 物品图标背景
        const itemIcon = this.add.graphics();
        itemIcon.fillStyle(this.getItemColor(item.type));
        itemIcon.fillCircle(0, 0, 30);
        itemIcon.lineStyle(2, 0xecf0f1);
        itemIcon.strokeCircle(0, 0, 30);
        
        // 物品名称（精简显示）
        const itemText = this.add.text(0, -18, item.name, 
            { 
                font: 'bold 11px Arial', 
                color: '#ffffff',
                stroke: '#2c3e50',
                strokeThickness: 2
            });
        itemText.setOrigin(0.5);
        
        // 物品数量
        const quantityText = this.add.text(0, 3, `×${item.quantity}`, 
            { 
                font: 'bold 15px Arial', 
                color: '#f39c12',
                stroke: '#2c3e50',
                strokeThickness: 2
            });
        quantityText.setOrigin(0.5);
        
        // 物品价值
        const valueText = this.add.text(0, 23, `$${item.value}`, 
            { 
                font: 'bold 11px Arial', 
                color: '#2ecc71',
                stroke: '#2c3e50',
                strokeThickness: 1
            });
        valueText.setOrigin(0.5);
        
        // 添加所有元素到容器
        itemContainer.add([itemIcon, itemText, quantityText, valueText]);
        itemContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 40), Phaser.Geom.Circle.Contains);
        itemContainer.setDepth(100);
        
        // 鼠标悬停效果（简化，不再显示详细信息）
        itemContainer.on('pointerover', () => {
            itemContainer.setScale(1.1);
        });
        
        itemContainer.on('pointerout', () => {
            itemContainer.setScale(1);
        });
        
        // 点击事件 - 显示操作菜单
        itemContainer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // 阻止事件冒泡到背景
            if (pointer.event) {
                pointer.event.stopPropagation();
            }
            // 延迟调用，确保当前点击事件完成后再显示菜单
            this.time.delayedCall(50, () => {
                this.showItemActionMenu(item, false, slotIndex);
            });
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
        const buttonY = height * 0.92;
        const buttonWidth = 150;
        const buttonHeight = 40;
        const buttonMargin = 15;
        
        const totalButtonsWidth = 4 * buttonWidth + 3 * buttonMargin;
        const startX = (width - totalButtonsWidth) / 2;
        
        const buttons = [
            { text: '📦 整理物品', x: startX + buttonWidth/2, action: () => this.organizeItems(), color: 0x3498db },
            { text: `🔼 升级(${this.upgradeCost}$)`, x: startX + buttonWidth + buttonMargin + buttonWidth/2, action: () => this.upgradeWarehouse(), color: 0xf39c12 },
            { text: '🔄 刷新界面', x: startX + 2*(buttonWidth + buttonMargin) + buttonWidth/2, action: () => this.refreshScene(), color: 0x16a085 }
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
        
        // 统计信息区域（屏幕顶部）
        const statsX = width * 0.06;
        const statsY = height * 0.05;
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
            { label: '📦 仓库', value: `${this.inventoryItems.length}/${this.maxCapacity}`, color: '#3498db' },
            { label: '🎒 背包', value: `${this.backpackItems.length}/12`, color: '#9b59b6' },
            { label: '💵 总价值', value: `$${this.totalValue}`, color: '#2ecc71' },
            { label: '🏪 等级', value: `Lv.${this.upgradeLevel}`, color: '#e67e22' }
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
            
            // 保存所有数据（确保持久化）
            this.saveWarehouseData();
            this.saveInventoryToStorage();
            this.savePlayerData();
            
            this.showMessage(`仓库升级成功！当前等级: ${this.upgradeLevel}，容量: ${this.maxCapacity}`);
            
            // 刷新界面
            this.scene.restart({ 
                playerHealth: this.playerHealth, 
                playerMoney: this.playerMoney,
                backpackItems: this.backpackItems,
                fromEvacuation: this.fromEvacuation
            });
        } else {
            this.showMessage(`金钱不足！需要 $${this.upgradeCost}`);
        }
    }

    private createControlsInfo() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 操作说明 - 屏幕底部
        const controlsText = this.add.text(
            width / 2,
            height * 0.96,
            '💡 提示: 点击物品查看详细信息并选择操作 | 鼠标悬停查看物品信息',
            { 
                font: '12px Arial', 
                color: '#bdc3c7',
                stroke: '#2c3e50',
                strokeThickness: 1
            }
        );
        controlsText.setOrigin(0.5, 1); // 居中，底部对齐
        
        // 键盘控制
        this.input.keyboard!.on('keydown-ESC', () => {
            this.returnToMenu();
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
    
    // 创建返回主菜单按钮（底部中央）
    private createReturnToMenuButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const buttonX = width / 2;
        const buttonY = height * 0.98;
        const buttonWidth = 200;
        const buttonHeight = 45;
        
        // 按钮背景
        const bg = this.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, 0xe74c3c, 0.9);
        bg.setStrokeStyle(3, 0xe74c3c);
        bg.setInteractive({ useHandCursor: true });
        bg.setDepth(1000);
        
        // 按钮文本
        const buttonText = this.add.text(buttonX, buttonY, '🏠 返回主菜单', {
            font: 'bold 18px Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        buttonText.setOrigin(0.5);
        buttonText.setDepth(1001);
        
        // 悬停效果
        bg.on('pointerover', () => {
            bg.setFillStyle(0xe74c3c, 1);
            bg.setScale(1.05);
            buttonText.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            bg.setFillStyle(0xe74c3c, 0.9);
            bg.setScale(1);
            buttonText.setScale(1);
        });
        
        bg.on('pointerdown', () => {
            this.returnToMenu();
        });
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

    // 未使用的方法 - 保留以备后用
    /* private sellSelectedItem() {
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
    } */

    private organizeItems() {
        // 按物品类型和价值排序
        this.inventoryItems.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            return b.value - a.value;
        });
        
        // 保存整理后的库存（确保持久化）
        this.saveInventoryToStorage();
        this.savePlayerData();
        
        this.showMessage('库存已按类型和价值排序整理完成');
        
        // 刷新界面
        this.scene.restart({ 
            playerHealth: this.playerHealth, 
            playerMoney: this.playerMoney,
            backpackItems: this.backpackItems,
            fromEvacuation: this.fromEvacuation
        });
    }

    // 未使用的方法 - 保留以备后用
    /* private returnToGame() {
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
    } */
    
    private returnToMenu() {
        try {
            // 保存所有数据（库存、金钱、血量等）
            this.saveInventoryToStorage();
            this.savePlayerData();
            
            // 停止当前场景
            this.scene.stop();
            
            // 启动主菜单
            this.scene.start('MenuScene');
            
            console.log('返回主菜单，数据已保存');
        } catch (error) {
            console.error('返回主菜单时出错:', error);
            // 即使出错也尝试返回菜单
            this.scene.stop();
            this.scene.start('MenuScene');
        }
    }
    
    // 保存玩家数据（金钱、血量等）
    private savePlayerData() {
        try {
            // 保存金钱（优先保存，确保不会丢失）
            localStorage.setItem('player_money', this.playerMoney.toString());
            localStorage.setItem('player_health', this.playerHealth.toString());
            console.log(`玩家数据已保存: 金钱=$${this.playerMoney}, 血量=${this.playerHealth}`);
        } catch (error) {
            console.warn('无法保存玩家数据:', error);
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
    
    // 显示物品操作菜单（合并信息面板）
    private showItemActionMenu(item: InventoryItem, isBackpack: boolean, slotIndex: number) {
        console.log('显示物品菜单:', item.name, '是否背包:', isBackpack);
        
        // 隐藏之前的菜单
        this.hideActionMenu();
        
        // 保存当前选中的物品信息
        this.currentSelectedItem = { item, isBackpack, slotIndex };
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 统一放在屏幕中间
        const menuX = width / 2;
        const menuY = height / 2;
        
        // 创建菜单容器
        this.actionMenu = this.add.container(menuX, menuY);
        
        // 计算面板尺寸
        const panelWidth = 400;
        const panelHeight = 380;
        
        // 菜单背景
        const menuBg = this.add.graphics();
        menuBg.fillStyle(0x2c3e50, 0.95);
        menuBg.fillRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, 15);
        menuBg.lineStyle(4, 0x3498db, 1.0);
        menuBg.strokeRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, 15);
        
        // 标题背景
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x3498db, 0.4);
        titleBg.fillRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, 50, { tl: 15, tr: 15, bl: 0, br: 0 });
        
        // 物品名称（标题）
        const menuTitle = this.add.text(0, -panelHeight/2 + 25, item.name, {
            font: 'bold 24px Arial',
            color: '#f1c40f',
            stroke: '#2c3e50',
            strokeThickness: 3
        });
        menuTitle.setOrigin(0.5);
        
        // 详细信息区域
        const infoStartY = -panelHeight/2 + 70;
        const infoLineHeight = 28;
        
        // 物品类型
        const typeText = this.add.text(-panelWidth/2 + 20, infoStartY, `类型: ${this.getItemTypeName(item.type)}`, {
            font: 'bold 16px Arial',
            color: '#ecf0f1',
            stroke: '#000000',
            strokeThickness: 2
        });
        
        // 物品数量
        const quantityText = this.add.text(-panelWidth/2 + 20, infoStartY + infoLineHeight, `数量: ${item.quantity}`, {
            font: 'bold 16px Arial',
            color: '#f39c12',
            stroke: '#000000',
            strokeThickness: 2
        });
        
        // 单价
        const valueText = this.add.text(-panelWidth/2 + 20, infoStartY + infoLineHeight * 2, `单价: $${item.value}`, {
            font: 'bold 16px Arial',
            color: '#2ecc71',
            stroke: '#000000',
            strokeThickness: 2
        });
        
        // 总价
        const totalText = this.add.text(-panelWidth/2 + 20, infoStartY + infoLineHeight * 3, `总价: $${item.value * item.quantity}`, {
            font: 'bold 16px Arial',
            color: '#2ecc71',
            stroke: '#000000',
            strokeThickness: 2
        });
        
        // 描述
        const descText = this.add.text(-panelWidth/2 + 20, infoStartY + infoLineHeight * 4, `描述: ${item.description}`, {
            font: '14px Arial',
            color: '#bdc3c7',
            wordWrap: { width: panelWidth - 40 }
        });
        
        // 分隔线
        const separator = this.add.graphics();
        separator.lineStyle(2, 0x3498db, 0.5);
        separator.lineBetween(-panelWidth/2 + 20, infoStartY + infoLineHeight * 5 + 10, panelWidth/2 - 20, infoStartY + infoLineHeight * 5 + 10);
        
        // 操作按钮区域
        const buttonWidth = 320;
        const buttonHeight = 40;
        const buttonSpacing = 12;
        let buttonY = infoStartY + infoLineHeight * 5 + 30;
        
        const buttons: Phaser.GameObjects.Container[] = [];
        
        // 移动按钮
        if (isBackpack) {
            const moveButton = this.createActionButton(0, buttonY, buttonWidth, buttonHeight, '➡️ 移到仓库', 0x2ecc71, () => {
                this.moveItemToWarehouse();
            });
            buttons.push(moveButton);
            buttonY += buttonHeight + buttonSpacing;
        } else {
            const moveButton = this.createActionButton(0, buttonY, buttonWidth, buttonHeight, '⬅️ 移到背包', 0x9b59b6, () => {
                this.moveItemToBackpack();
            });
            buttons.push(moveButton);
            buttonY += buttonHeight + buttonSpacing;
        }
        
        // 出售按钮
        const sellButton = this.createActionButton(0, buttonY, buttonWidth, buttonHeight, `💰 出售物品 (+$${item.value * item.quantity})`, 0xe74c3c, () => {
            this.sellItem();
        });
        buttons.push(sellButton);
        buttonY += buttonHeight + buttonSpacing;
        
        // 使用按钮（如果可用）
        if (item.type === 'MEDICAL' || item.type === 'FOOD') {
            const useButton = this.createActionButton(0, buttonY, buttonWidth, buttonHeight, '💊 使用物品', 0x27ae60, () => {
                this.useItem(item);
            });
            buttons.push(useButton);
            buttonY += buttonHeight + buttonSpacing;
        }
        
        // 关闭按钮
        const closeButton = this.createActionButton(0, buttonY, buttonWidth, buttonHeight, '✖️ 关闭', 0x95a5a6, () => {
            this.hideActionMenu();
        });
        buttons.push(closeButton);
        
        // 将所有元素添加到容器
        this.actionMenu.add([menuBg, titleBg, menuTitle, typeText, quantityText, valueText, totalText, descText, separator, ...buttons]);
        this.actionMenu.setDepth(3000);
        
        // 点击外部区域关闭菜单（延迟注册，避免立即触发）
        this.time.delayedCall(200, () => {
            const globalClickHandler = (pointer: Phaser.Input.Pointer) => {
                if (!this.actionMenu) return;
                
                const bounds = new Phaser.Geom.Rectangle(
                    menuX - panelWidth/2,
                    menuY - panelHeight/2,
                    panelWidth,
                    panelHeight
                );
                
                if (!bounds.contains(pointer.x, pointer.y)) {
                    this.hideActionMenu();
                    this.input.off('pointerdown', globalClickHandler);
                }
            };
            
            this.input.on('pointerdown', globalClickHandler);
        });
    }
    
    // 创建操作按钮
    private createActionButton(x: number, y: number, width: number, height: number, text: string, color: number, callback: () => void): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        // 按钮背景（降低透明度，更清晰）
        const bg = this.add.rectangle(0, 0, width, height, color, 1.0); // 完全不透明
        bg.setStrokeStyle(3, color, 1.0); // 更粗的边框，完全不透明
        bg.setInteractive({ useHandCursor: true });
        
        // 按钮文本（更明显的文字）
        const buttonText = this.add.text(0, 0, text, {
            font: 'bold 18px Arial', // 更大的字体
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3 // 更粗的描边
        });
        buttonText.setOrigin(0.5);
        
        // 悬停效果
        bg.on('pointerover', () => {
            bg.setFillStyle(color, 1.0);
            bg.setScale(1.08); // 更大的缩放效果
            buttonText.setScale(1.08);
        });
        
        bg.on('pointerout', () => {
            bg.setFillStyle(color, 1.0);
            bg.setScale(1);
            buttonText.setScale(1);
        });
        
        bg.on('pointerdown', callback);
        
        container.add([bg, buttonText]);
        return container;
    }
    
    // 隐藏操作菜单
    private hideActionMenu() {
        if (this.actionMenu) {
            console.log('关闭物品菜单');
            this.actionMenu.destroy();
            this.actionMenu = null;
        }
        this.currentSelectedItem = null;
        this.hideItemDetails();
    }
    
    // 移动物品到仓库
    private moveItemToWarehouse() {
        if (!this.currentSelectedItem || !this.currentSelectedItem.isBackpack) {
            this.showMessage('请选择背包物品');
            return;
        }
        
        const { item, slotIndex } = this.currentSelectedItem;
        
        if (this.inventoryItems.length >= this.maxCapacity) {
            this.showMessage(`仓库已满！当前容量: ${this.maxCapacity}`);
            this.hideActionMenu();
            return;
        }
        
        // 添加到仓库
        this.inventoryItems.push({ ...item });
        
        // 从背包移除
        this.backpackItems.splice(slotIndex, 1);
        
        // 保存数据（确保持久化）
        this.saveInventoryToStorage();
        this.savePlayerData();
        this.calculateTotalValue();
        
        this.showMessage(`成功将 ${item.name} x${item.quantity} 移到仓库`);
        this.hideActionMenu();
        
        // 刷新界面
        this.scene.restart({
            playerHealth: this.playerHealth,
            playerMoney: this.playerMoney,
            backpackItems: this.backpackItems,
            fromEvacuation: this.fromEvacuation
        });
    }
    
    // 移动物品到背包
    private moveItemToBackpack() {
        if (!this.currentSelectedItem || this.currentSelectedItem.isBackpack) {
            this.showMessage('请选择仓库物品');
            return;
        }
        
        const { item, slotIndex } = this.currentSelectedItem;
        
        if (this.backpackItems.length >= 12) {
            this.showMessage('背包已满！最多12个物品');
            this.hideActionMenu();
            return;
        }
        
        // 添加到背包
        this.backpackItems.push({ ...item });
        
        // 从仓库移除
        this.inventoryItems.splice(slotIndex, 1);
        
        // 保存数据（确保持久化）
        this.saveInventoryToStorage();
        this.savePlayerData();
        this.calculateTotalValue();
        
        this.showMessage(`成功将 ${item.name} x${item.quantity} 移到背包`);
        this.hideActionMenu();
        
        // 刷新界面
        this.scene.restart({
            playerHealth: this.playerHealth,
            playerMoney: this.playerMoney,
            backpackItems: this.backpackItems,
            fromEvacuation: this.fromEvacuation
        });
    }
    
    // 出售物品
    private sellItem() {
        if (!this.currentSelectedItem) {
            this.showMessage('请选择物品');
            return;
        }
        
        const { item, isBackpack, slotIndex } = this.currentSelectedItem;
        const sellValue = item.value * item.quantity;
        
        // 增加玩家金钱
        this.playerMoney += sellValue;
        
        // 从对应位置移除物品
        if (isBackpack) {
            this.backpackItems.splice(slotIndex, 1);
        } else {
            this.inventoryItems.splice(slotIndex, 1);
        }
        
        // 保存数据（确保持久化，出售后物品会消失）
        // 优先保存金钱数据，确保金钱不会丢失
        this.savePlayerData();
        this.saveInventoryToStorage();
        this.calculateTotalValue();
        
        // 显示出售信息
        this.showMessage(`成功出售 ${item.name} x${item.quantity}，获得 $${sellValue} | 当前金钱: $${this.playerMoney}`);
        this.hideActionMenu();
        
        // 刷新界面
        this.scene.restart({
            playerHealth: this.playerHealth,
            playerMoney: this.playerMoney,
            backpackItems: this.backpackItems,
            fromEvacuation: this.fromEvacuation
        });
    }
    
    // 未使用的方法 - 保留以备后用
    /* private showItemDetails(_item: InventoryItem) {
        // 不再单独显示详细信息面板，已合并到操作菜单中
        // 保留此方法以防其他地方调用
    } */
    
    private hideItemDetails() {
        // 未使用的属性，注释掉相关代码
        /*
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
        */
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
    
    // 创建背包UI
    private createBackpackUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 背包区域背景（左侧）
        const backpackBg = this.add.graphics();
        const backpackWidth = width * 0.45;
        const backpackHeight = height * 0.65;
        const backpackX = width * 0.03;
        const backpackY = height * 0.15;
        
        backpackBg.fillStyle(0x34495e, 0.9);
        backpackBg.fillRoundedRect(backpackX, backpackY, backpackWidth, backpackHeight, 12);
        backpackBg.lineStyle(3, 0x9b59b6);
        backpackBg.strokeRoundedRect(backpackX, backpackY, backpackWidth, backpackHeight, 12);
        
        // 背包标题
        const backpackTitle = this.add.text(
            backpackX + backpackWidth / 2,
            backpackY + 25,
            '🎒 背包物品',
            { 
                font: 'bold 28px Arial', 
                color: '#ecf0f1',
                stroke: '#2c3e50',
                strokeThickness: 3
            }
        );
        backpackTitle.setOrigin(0.5);
        
        // 创建背包物品槽
        const slotsPerRow = 4; // 与仓库保持一致
        const slotSize = 80;
        const slotSpacing = 10;
        
        const totalSlotWidth = slotsPerRow * slotSize + (slotsPerRow - 1) * slotSpacing;
        const startX = backpackX + (backpackWidth - totalSlotWidth) / 2;
        const startY = backpackY + 70;
        
        // 背包最多12个物品
        const maxBackpackSlots = 12;
        for (let i = 0; i < maxBackpackSlots; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            // 创建背包槽位背景
            const slot = this.add.graphics();
            slot.fillStyle(0x2c3e50, 0.8);
            slot.fillRoundedRect(x, y, slotSize, slotSize, 6);
            slot.lineStyle(2, 0x9b59b6, 0.6);
            slot.strokeRoundedRect(x, y, slotSize, slotSize, 6);
            slot.setDepth(50);
            
            this.backpackSlots.push(slot);
            
            // 创建物品（如果该槽位有物品）
            if (i < this.backpackItems.length) {
                this.createBackpackItemInSlot(i, x + slotSize / 2, y + slotSize / 2);
            }
        }
    }
    
    // 在背包槽位中创建物品
    private createBackpackItemInSlot(slotIndex: number, x: number, y: number) {
        if (slotIndex >= this.backpackItems.length) return;
        
        const item = this.backpackItems[slotIndex];
        
        // 创建物品容器
        const itemContainer = this.add.container(x, y);
        
        // 物品图标背景
        const itemIcon = this.add.graphics();
        itemIcon.fillStyle(this.getItemColor(item.type));
        itemIcon.fillCircle(0, 0, 28);
        itemIcon.lineStyle(2, 0xecf0f1);
        itemIcon.strokeCircle(0, 0, 28);
        
        // 物品数量
        const quantityText = this.add.text(0, 0, `×${item.quantity}`, 
            { 
                font: 'bold 14px Arial', 
                color: '#f39c12',
                stroke: '#2c3e50',
                strokeThickness: 2
            });
        quantityText.setOrigin(0.5);
        
        // 添加元素到容器
        itemContainer.add([itemIcon, quantityText]);
        itemContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
        itemContainer.setDepth(100);
        
        // 交互效果（简化，不再显示详细信息）
        itemContainer.on('pointerover', () => {
            itemContainer.setScale(1.1);
        });
        
        itemContainer.on('pointerout', () => {
            itemContainer.setScale(1);
        });
        
        itemContainer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // 阻止事件冒泡
            if (pointer.event) {
                pointer.event.stopPropagation();
            }
            // 延迟调用，确保当前点击事件完成后再显示菜单
            this.time.delayedCall(50, () => {
                this.showItemActionMenu(item, true, slotIndex);
            });
        });
    }
    
    // 选择背包槽位
    // 未使用的方法 - 保留以备后用
    /* private selectBackpackSlot(slotIndex: number) {
        // 取消之前的选择
        if (this.selectedBackpackSlot >= 0 && this.selectedBackpackSlot < this.backpackSlots.length) {
            const prevSlot = this.backpackSlots[this.selectedBackpackSlot];
            const slotSize = 70;
            const slotsPerRow = 6;
            const slotSpacing = 10;
            const backpackWidth = this.cameras.main.width * 0.88;
            const backpackX = (this.cameras.main.width - backpackWidth) / 2;
            const totalSlotWidth = slotsPerRow * slotSize + (slotsPerRow - 1) * slotSpacing;
            const startX = backpackX + (backpackWidth - totalSlotWidth) / 2;
            const startY = this.cameras.main.height * 0.68 + 55;
            
            const row = Math.floor(this.selectedBackpackSlot / slotsPerRow);
            const col = this.selectedBackpackSlot % slotsPerRow;
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            prevSlot.clear();
            prevSlot.fillStyle(0x2c3e50, 0.8);
            prevSlot.fillRoundedRect(x, y, slotSize, slotSize, 6);
            prevSlot.lineStyle(2, 0x9b59b6, 0.6);
            prevSlot.strokeRoundedRect(x, y, slotSize, slotSize, 6);
        }
        
        // 选择新槽位
        this.selectedBackpackSlot = slotIndex;
        
        // 高亮选中的槽位
        if (slotIndex < this.backpackSlots.length) {
            const slot = this.backpackSlots[slotIndex];
            const slotSize = 70;
            const slotsPerRow = 6;
            const slotSpacing = 10;
            const backpackWidth = this.cameras.main.width * 0.88;
            const backpackX = (this.cameras.main.width - backpackWidth) / 2;
            const totalSlotWidth = slotsPerRow * slotSize + (slotsPerRow - 1) * slotSpacing;
            const startX = backpackX + (backpackWidth - totalSlotWidth) / 2;
            const startY = this.cameras.main.height * 0.68 + 55;
            
            const row = Math.floor(slotIndex / slotsPerRow);
            const col = slotIndex % slotsPerRow;
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            slot.clear();
            slot.fillStyle(0x2c3e50, 0.8);
            slot.fillRoundedRect(x, y, slotSize, slotSize, 6);
            slot.lineStyle(4, 0xf1c40f);
            slot.strokeRoundedRect(x, y, slotSize, slotSize, 6);
        }
        
        console.log(`选中背包槽位 ${slotIndex + 1}`);
    } */
    
    // 刷新场景
    private refreshScene() {
        this.scene.restart({
            playerHealth: this.playerHealth,
            playerMoney: this.playerMoney,
            backpackItems: this.backpackItems,
            fromEvacuation: this.fromEvacuation
        });
    }
    
    update() {
        // 仓库场景不需要每帧更新
    }
}

export default WarehouseScene;