import Phaser from 'phaser';
import { GameConstants } from '../config/gameConfig';

// 武器配置接口
interface WeaponConfig {
    name: string;
    damage: number;
    fireRate: number;
    range: number;
    bulletSpeed: number;
    ammoCapacity: number;
    bulletSize: number;
    color: number;
    ammoType?: string; // 弹药类型：'pistol', 'rifle', 'shotgun'
    precision?: number; // 精度（0-1，1为完美精度）
    recoil?: number; // 后坐力（角度偏移，弧度）
    spread?: number; // 扩散角度（度，用于霰弹枪）
}

// 武器类
class Weapon {
    name: string;
    damage: number;
    fireRate: number;
    range: number;
    bulletSpeed: number;
    ammoCapacity: number;
    currentAmmo: number;
    bulletSize: number;
    color: number;
    lastFired: number;
    isReloading: boolean;
    reserveAmmo: number; // 备用弹药
    maxReserveAmmo: number; // 最大备用弹药容量
    ammoType: string; // 弹药类型
    precision: number; // 精度（0-1）
    recoil: number; // 后坐力（弧度）
    spread?: number; // 扩散角度（度）
    currentRecoil: number; // 当前后坐力累积

    constructor(config: WeaponConfig) {
        this.name = config.name;
        this.damage = config.damage;
        this.fireRate = config.fireRate;
        this.range = config.range;
        this.bulletSpeed = config.bulletSpeed;
        this.ammoCapacity = config.ammoCapacity;
        this.currentAmmo = config.ammoCapacity;
        this.bulletSize = config.bulletSize;
        this.color = config.color;
        this.lastFired = 0;
        this.isReloading = false;
        this.reserveAmmo = 0;
        this.maxReserveAmmo = config.ammoCapacity * 5;
        this.ammoType = config.ammoType || 'pistol';
        this.precision = config.precision !== undefined ? config.precision : 0.9;
        this.recoil = config.recoil !== undefined ? config.recoil : 0.05;
        this.spread = config.spread;
        this.currentRecoil = 0;
    }

    canShoot(time: number): boolean {
        return !this.isReloading && 
               time - this.lastFired >= this.fireRate && 
               this.currentAmmo > 0;
    }

    shoot(time: number): boolean {
        if (!this.canShoot(time)) return false;
        
        this.lastFired = time;
        this.currentAmmo--;
        // 增加后坐力
        this.currentRecoil = Math.min(this.currentRecoil + this.recoil, this.recoil * 3);
        return true;
    }

    reload(): void {
        if (this.isReloading || this.currentAmmo === this.ammoCapacity) return;
        
        this.isReloading = true;
        
        // 触发换弹音效（在GameScene中处理）
        
        setTimeout(() => {
            const ammoNeeded = this.ammoCapacity - this.currentAmmo;
            const ammoToReload = Math.min(ammoNeeded, this.reserveAmmo);
            this.currentAmmo += ammoToReload;
            this.reserveAmmo -= ammoToReload;
            this.isReloading = false;
            // 重置后坐力
            this.currentRecoil = 0;
        }, 2500); // 改为2.5秒换弹时间
    }

    // 更新后坐力（随时间衰减）
    updateRecoil(delta: number): void {
        if (this.currentRecoil > 0) {
            this.currentRecoil = Math.max(0, this.currentRecoil - delta * 0.001);
        }
    }

    // 获取当前射击角度偏移（考虑后坐力和精度）
    getShootAngleOffset(): number {
        // 精度误差（随机）
        const precisionError = (1 - this.precision) * (Math.random() * 2 - 1) * 0.3;
        // 后坐力偏移
        const recoilOffset = this.currentRecoil * (Math.random() * 2 - 1);
        return precisionError + recoilOffset;
    }
}

// 物品稀有度枚举
enum ItemRarity {
    COMMON = 'common',      // 普通
    UNCOMMON = 'uncommon',  // 不常见
    RARE = 'rare',          // 稀有
    EPIC = 'epic',          // 史诗
    LEGENDARY = 'legendary' // 传说
}

// 物品接口 - 参考2.0.1版本的物品系统
interface GameItem {
    id: string;
    type: 'weapon' | 'ammo' | 'armor' | 'medical' | 'artifact' | 'money' | 'resource';
    subtype?: string; // 子类型，用于区分同类物品的不同变种
    x: number;
    y: number;
    graphic: Phaser.GameObjects.Graphics;
    body: Phaser.Physics.Arcade.Sprite;
    value?: number; // 用于金钱、医疗等数值物品
    name?: string; // 物品名称
    quantity?: number; // 数量
    glowGraphic?: Phaser.GameObjects.Graphics | null; // 发光效果图形（允许为null）
    // 新增属性
    weight?: number; // 重量（影响移动速度和背包容量）
    rarity?: ItemRarity; // 稀有度（影响生成概率和价值）
    durability?: number; // 耐久度（部分装备有使用限制）
    maxDurability?: number; // 最大耐久度
}

// 敌人接口 - 参考2.0.1版本的敌人系统
interface Enemy {
    id: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number; // 最大血量
    graphic: Phaser.GameObjects.Graphics;
    eyeGraphic?: Phaser.GameObjects.Graphics | null;
    healthBarBg?: Phaser.GameObjects.Graphics; // 血量条背景
    healthBar?: Phaser.GameObjects.Graphics; // 血量条
    typeLabel?: Phaser.GameObjects.Text; // 类型标签
    body: Phaser.Physics.Arcade.Sprite;
    state: 'patrol' | 'chase' | 'attack';
    speed: number;
    type?: string; // 敌人类型（grunt, soldier, captain）
    lastPlayerSpotted?: number; // 最后一次发现玩家的时间戳
    patrolPath?: {x: number, y: number}[]; // 巡逻路径
    isHit?: boolean; // 敌人是否被击中
    hitTimer?: number; // 击中效果计时器
    stateVisualTween?: Phaser.Tweens.Tween | null; // 状态视觉动画
    lastAttack?: number; // 上次攻击时间
    patrolIndex?: number; // 巡逻路径索引
}

// 撤离点接口
interface EvacuationPoint {
    x: number;
    y: number;
    graphic: Phaser.GameObjects.Graphics;
    active: boolean;
    countdown?: number; // 倒计时（秒）
    requiredItems?: string[]; // 需要的特殊物品
    countdownText?: Phaser.GameObjects.Text; // 倒计时文本
    isCountdownActive?: boolean; // 是否正在倒计时
}

export default class GameScene extends Phaser.Scene {
    // 玩家相关属性
    private player!: Phaser.GameObjects.Graphics;
    private playerBody!: Phaser.Physics.Arcade.Sprite; // 添加玩家物理体引用
    private playerHealth: number = GameConstants.PLAYER?.HEALTH || 100;
    private playerMaxHealth: number = GameConstants.PLAYER?.HEALTH || 100;
    private playerMoney: number = 0;
    private playerSpeed: number = 200;
    private basePlayerSpeed: number = 200; // 基础移动速度
    private totalWeight: number = 0; // 玩家当前总重量
    private playerX: number = 400;
    private playerY: number = 300;
    private playerArmor: number = 0;
    private playerBackpack: GameItem[] = [];
    private isInventoryOpen: boolean = false; // 背包是否打开
    private inventoryPanel?: Phaser.GameObjects.Container; // 背包面板
    // 相机摇晃功能已移除
    private playerIsInvincible: boolean = false; // 玩家无敌状态
    private enemiesKilled: number = 0; // 已击杀敌人数量
    private playerMoving: boolean = false; // 玩家是否在移动

    
    // 输入控制
    private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: {
        w: Phaser.Input.Keyboard.Key;
        a: Phaser.Input.Keyboard.Key;
        s: Phaser.Input.Keyboard.Key;
        d: Phaser.Input.Keyboard.Key;
    };
    
    // 游戏状态
    private gameTime: number = 0;
    private collectedItems: number = 0;
    private gameStarted: boolean = false;
    private evacuationAvailable: boolean = false;

    
    // 物理组和对象
    private walls!: Phaser.Physics.Arcade.StaticGroup;
    private playerHealthBar!: Phaser.GameObjects.Graphics;
    private playerArmorBar!: Phaser.GameObjects.Graphics; // 添加护甲条
    private timerText!: Phaser.GameObjects.Text;
    private moneyText!: Phaser.GameObjects.Text;
    private weaponText!: Phaser.GameObjects.Text;
    private crosshairGraphic!: Phaser.GameObjects.Graphics;
    private evacuationText!: Phaser.GameObjects.Text; // 撤离提示文本
    
    // 交互对象组
    private interactiveObjects!: Phaser.Physics.Arcade.Group;
    private destructibleObjects!: Phaser.Physics.Arcade.Group;
    private doors!: Phaser.Physics.Arcade.Group;
    
    // 游戏实体数组
    private items: GameItem[] = [];
    private enemies: Enemy[] = [];
    private evacuationPoints: EvacuationPoint[] = [];
    private evacuationSwitch?: any; // 撤离点开关对象
    private evacuationSwitchActivated: boolean = false; // 开关是否已激活
    private evacuationDoorway?: any; // 撤离点门口（用于存储移除的墙壁信息，可能用于将来扩展）
    private eKeyPressed: boolean = false; // E键是否刚被按下
    
    // 武器系统
    private weapons: Weapon[] = [];
    private backgroundMusic?: Phaser.Sound.BaseSound; // 背景音乐

    
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        console.log('GameScene 创建完成');
        
        try {
            // 设置背景色（几乎黑色，让房间颜色更突出）
            this.cameras.main.setBackgroundColor(0x000000);
            
            // 先设置相机边界，确保地图能正确显示
            this.cameras.main.setBounds(0, 0, 8000, 6000);
            
            // 初始化物理系统
            if (!this.physics) {
                console.error('物理系统初始化失败');
                return;
            }
            
            // 创建墙壁组
            this.walls = this.physics.add.staticGroup();
            
            // 创建简单地图（使用精灵而不是瓦片地图）
            this.createSimpleMap();
            
            // 创建玩家（使用图形而不是精灵）
            this.createPlayer();
            
            // 设置键盘控制
            this.setupKeyboard();
            
            // 创建HUD
            this.createHUD();
            
            // 初始化武器系统
            this.initWeapons();
            
            // 设置相机
            this.setupCamera();
            
            // 设置鼠标控制
            this.setupMouse();
            
            // 添加一些装饰元素
            this.addDecorations();
            
            // 创建固定位置的小地图
            this.createMiniMap();
            
            // 添加游戏物品
            this.addGameItems();
            
            // 添加敌人
            this.addEnemies();
            
            // 添加撤离点
            this.addEvacuationPoints();
            
            // 显示游戏开始提示
            this.showGameStartMessage();
            
        } catch (error) {
            console.error('游戏初始化错误:', error);
        }
    }
    
    update(_time: number, delta: number) {
        try {
            if (!this.gameStarted) return;
            
            // 性能优化：限制delta值避免帧率波动影响
            const clampedDelta = Math.min(delta, 33); // 最多33ms (30 FPS)
            
            // 确保相机跟随玩家（如果还没设置）
            if (this.playerBody && this.cameras.main && !(this.cameras.main as any)._followTarget) {
                this.setupCamera();
            }
            
            // 更新游戏时间
            this.gameTime += delta / 1000;
            
            // 性能优化：减少HUD更新频率（每5帧更新一次）
            if (!(this as any).frameCount) (this as any).frameCount = 0;
            (this as any).frameCount++;
            
            if ((this as any).frameCount % 5 === 0) {
                this.timerText?.setText(`⏱ 时间: ${Math.floor(this.gameTime)}s`);
                this.updateHUD();
            }
            
            // 更新玩家移动
            this.updatePlayerMovement(clampedDelta);
            
            // 同步玩家图形位置（每帧更新以确保跟随）
            if (this.playerBody && this.player) {
                this.playerX = this.playerBody.x;
                this.playerY = this.playerBody.y;
                this.player.setPosition(this.playerBody.x, this.playerBody.y);
                if ((this as any).playerGlowGraphic) {
                    (this as any).playerGlowGraphic.setPosition(this.playerBody.x, this.playerBody.y);
                }
            }
            
            // 更新十字准星位置（使用世界坐标）
            if (this.crosshairGraphic) {
                // 准星使用屏幕坐标
                this.crosshairGraphic.x = this.input.activePointer.x;
                this.crosshairGraphic.y = this.input.activePointer.y;
            }
            
            // 更新敌人AI
            this.updateEnemies(clampedDelta);
            
            // 性能优化：减少检查频率
            if ((this as any).frameCount % 2 === 0) {
                this.checkItemCollection();
                this.checkEvacuationStatus();
            }
            
            // 更新撤离点状态
            this.updateEvacuationPoints(clampedDelta);
            
            // 性能优化：减少交互检查频率
            if ((this as any).frameCount % 3 === 0) {
                this.checkInteractiveObjects();
            }
            
            // 检查撤离点开关交互
            this.checkEvacuationSwitch();
            
            // 更新小地图
            if ((this as any).frameCount % 10 === 0) {
                this.updateMiniMap();
            }
            
            // 处理可破坏物体
            this.updateDestructibleObjects();
            
            // 更新门的状态
            this.updateDoors();
            
            // 更新动画效果
            this.updateAnimations();
            
            // 处理TAB键打开/关闭背包
            if (this.keys && (this.keys as any).tab && Phaser.Input.Keyboard.JustDown((this.keys as any).tab)) {
                this.toggleInventory();
            }
            
            // 更新武器后坐力衰减
            this.weapons.forEach(weapon => {
                weapon.updateRecoil(clampedDelta);
            });
            
            // 处理连续射击（使用世界坐标）
            if ((this as any).isShooting && this.playerBody) {
                const now = this.time.now;
                const weaponIndex = (this as any).currentWeaponIndex || 0;
                const weapon = this.weapons[weaponIndex];
                if (weapon && now - (this as any).lastShootTime >= weapon.fireRate) {
                    const pointer = this.input.activePointer;
                    // 使用世界坐标进行射击
                    this.shoot(pointer.worldX, pointer.worldY);
                    (this as any).lastShootTime = now;
                }
            }
            
        } catch (error) {
            console.error('游戏更新错误:', error);
        }
    }
    
    // 重新设计的地图创建系统 - 确保所有元素尺寸一致，无错位
    private createSimpleMap() {
        try {
            // 设置统一的网格单元大小
            const gridSize = 80; // 使用单一统一的网格尺寸
            
            // 设置世界边界，确保与网格系统匹配
            const worldWidth = 8000;
            const worldHeight = 6000;
            this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
            
            // 设置输入区域为整个地图范围
            this.input.setTopOnly(false);
            
            // 创建交互对象组
            this.interactiveObjects = this.physics.add.group();
            this.destructibleObjects = this.physics.add.group();
            this.doors = this.physics.add.group();
            
            // 创建背景网格，使用与地图相同的尺寸（在对象组之后）
            this.createBackground(worldWidth, worldHeight, gridSize);
            
            // 定义房间系统 - 确认位置和尺寸
            const rooms = [
                { x: 10, y: 10, width: 10, height: 8, type: 'start', color: 0x4A6FA5, name: '起始区域' },
                { x: 24, y: 10, width: 12, height: 10, type: 'main', color: 0x5D4037, name: '中央大厅' },
                { x: 10, y: 22, width: 8, height: 6, type: 'side', color: 0x3E4C59, name: '左侧仓库' },
                { x: 40, y: 10, width: 8, height: 8, type: 'side', color: 0x3E4C59, name: '右侧军械库' },
                { x: 24, y: 24, width: 10, height: 8, type: 'treasure', color: 0x6D4C41, name: '宝藏室' },
                { x: 38, y: 22, width: 8, height: 6, type: 'evac', color: 0x2E7D32, name: '撤离点' },
                { x: 50, y: 15, width: 5, height: 5, type: 'side', color: 0x3E4C59, name: '观察点' },
                { x: 24, y: 5, width: 8, height: 4, type: 'side', color: 0x3E4C59, name: '补给站' }
            ];
            
            
            // 创建特殊区域
            this.createSpecialAreas();
            
            // 创建撤离点开关
            this.createEvacuationSwitch(rooms, gridSize);
            
            // 绘制房间
            rooms.forEach(room => {
                const roomX = room.x * gridSize;
                const roomY = room.y * gridSize;
                const roomW = room.width * gridSize;
                const roomH = room.height * gridSize;
                
                // 创建房间地板基础层（深色背景）
                const floorBase = this.add.graphics();
                floorBase.fillStyle(0x0a0a0a, 1);
                floorBase.fillRect(0, 0, roomW, roomH);
                floorBase.setPosition(roomX, roomY);
                floorBase.setDepth(-51);
                floorBase.setVisible(true);
                floorBase.setScrollFactor(1, 1); // 确保跟随相机
                
                // 创建房间地板主色层（更鲜艳的颜色）
                const floorGraphic = this.add.graphics();
                // 使用更亮的颜色，不减去太多
                const baseColor = room.color;
                floorGraphic.fillStyle(baseColor, 0.85); // 提高不透明度
                floorGraphic.fillRect(0, 0, roomW, roomH);
                
                // 添加地板图案（更明显）
                this.addFloorPattern(floorGraphic, room.type, roomW, roomH);
                
                floorGraphic.setPosition(roomX, roomY);
                floorGraphic.setDepth(-50);
                floorGraphic.setVisible(true);
                floorGraphic.setScrollFactor(1, 1); // 确保跟随相机
                
                // 房间边框（更粗更明显）
                const borderGraphic = this.add.graphics();
                borderGraphic.lineStyle(6, baseColor, 1); // 更粗的边框
                borderGraphic.strokeRect(3, 3, roomW - 6, roomH - 6);
                // 添加内边框
                borderGraphic.lineStyle(2, 0xffffff, 0.5);
                borderGraphic.strokeRect(6, 6, roomW - 12, roomH - 12);
                borderGraphic.setPosition(roomX, roomY);
                borderGraphic.setDepth(-40);
                borderGraphic.setVisible(true);
                borderGraphic.setScrollFactor(1, 1); // 确保跟随相机
                
                // 为每个房间创建墙壁，传入正确的gridSize参数
                this.createRoomWalls(room.x, room.y, room.width, room.height, room.color, gridSize);
                
                console.log(`房间 ${room.name} 创建完成: 位置(${room.x}, ${room.y}), 尺寸(${room.width}x${room.height})`);
            });
            
            // 创建外围墙壁
            this.createOuterWalls(rooms, [], gridSize);
            
            // 在房间中添加细节元素
            this.addRoomDetails(rooms, gridSize);
            
            // 添加装饰性物体
            this.addDecorativeObjects(rooms, [], gridSize);
            
            // 添加环境效果
            this.addEnvironmentalEffects();
            
            // 确保相机初始位置正确（在起始房间）
            const startRoomX = 10 * gridSize;
            const startRoomY = 10 * gridSize;
            const startRoomW = 10 * gridSize;
            const startRoomH = 8 * gridSize;
            const startCenterX = startRoomX + startRoomW / 2;
            const startCenterY = startRoomY + startRoomH / 2;
            
            // 立即将相机移动到起始房间中心
            this.cameras.main.centerOn(startCenterX, startCenterY);
            
            console.log('地图创建成功 - 统一尺寸系统确保无错位');
            console.log('起始房间中心位置:', startCenterX, startCenterY);
            console.log('相机位置:', this.cameras.main.scrollX, this.cameras.main.scrollY);
            
        } catch (error) {
            console.error('创建地图时出错:', error);
        }
    }
    
    // 获取房间的门口位置（基于走廊连接）
    private getDoorwayPositions(roomX: number, roomY: number, roomWidth: number, roomHeight: number): {side: string, pos: number}[] {
        const doorways: {side: string, pos: number}[] = [];
        
        // 根据房间位置和走廊定义，确定门口位置
        // 走廊定义和对应的门口位置：
        
        // 起始房间 (10, 10, 10, 8) - 右边界x=20, 底部y=18
        if (roomX === 10 && roomY === 10) {
            // 走廊 { x: 20, y: 12, width: 4, height: 1 } - 水平走廊，从x=20开始（起始房间右边界）
            // y=12相对于房间y=10，位置是2（从顶部开始）
            doorways.push({side: 'right', pos: 2}); // 右侧，连接中央大厅
            // 走廊 { x: 10, y: 17, width: 5, height: 1 } - 水平走廊
            // 起始房间左边界x=10，走廊从x=10开始，所以走廊在左边界上
            // y=17在房间内（y范围10-18），相对于房间顶部y=10，位置是7
            doorways.push({side: 'left', pos: 7}); // 左侧，连接安全屋
            // 走廊 { x: 14, y: 22, width: 1, height: 6 } - 垂直走廊
            // 起始房间底部y=18，但走廊从y=22开始，所以不直接连接
            // 实际上这个走廊连接的是左侧仓库，不是起始房间
        }
        
        // 中央大厅 (24, 10, 12, 10)
        if (roomX === 24 && roomY === 10) {
            // 走廊 { x: 20, y: 12, width: 4, height: 1 } - 左侧，y=12相对于房间y=10，位置是2
            doorways.push({side: 'left', pos: 2}); // 左侧，连接起始房间
            // 走廊 { x: 36, y: 12, width: 4, height: 1 } - 右侧，y=12相对于房间y=10，位置是2
            doorways.push({side: 'right', pos: 2}); // 右侧，连接右侧房间
            // 走廊 { x: 28, y: 20, width: 1, height: 4 } - 底部，x=28相对于房间x=24，位置是4
            doorways.push({side: 'bottom', pos: 4}); // 底部，连接宝藏房间
            // 走廊 { x: 28, y: 10, width: 1, height: 5 } - 顶部，x=28相对于房间x=24，位置是4
            doorways.push({side: 'top', pos: 4}); // 顶部，连接补给站
        }
        
        
        // 右侧房间 (40, 10, 8, 8)
        if (roomX === 40 && roomY === 10) {
            // 走廊 { x: 36, y: 12, width: 4, height: 1 } - 左侧，y=12相对于房间y=10，位置是2
            doorways.push({side: 'left', pos: 2}); // 左侧，连接中央大厅
            // 走廊 { x: 40, y: 17, width: 5, height: 1 } - 左侧，y=17相对于房间y=10，位置是7
            doorways.push({side: 'left', pos: 7}); // 左侧偏下，连接观察点区域
        }
        
        // 宝藏房间 (24, 24, 10, 8)
        if (roomX === 24 && roomY === 24) {
            // 走廊 { x: 28, y: 20, width: 1, height: 4 } - 顶部，x=28相对于房间x=24，位置是4
            doorways.push({side: 'top', pos: 4}); // 顶部，连接中央大厅
            // 走廊 { x: 34, y: 25, width: 3, height: 1 } - 右侧，y=25相对于房间y=24，位置是1
            doorways.push({side: 'right', pos: 1}); // 右侧偏上，连接撤离点
        }
        
        // 撤离点房间 (36, 22, 8, 6)
        if (roomX === 36 && roomY === 22) {
            // 走廊 { x: 34, y: 25, width: 3, height: 1 } - 左侧，y=25相对于房间y=22，位置是3
            doorways.push({side: 'left', pos: 3}); // 左侧，连接宝藏房间
        }
        
        // 安全屋 (5, 15, 5, 5) - 右边界在x=10, 底部y=20
        if (roomX === 5 && roomY === 15) {
            // 走廊 { x: 10, y: 17, width: 5, height: 1 } - 水平走廊
            doorways.push({side: 'right', pos: 2}); // 右侧，连接起始房间
            // 走廊 { x: 10, y: 20, width: 4, height: 1 } - 底部水平走廊
            doorways.push({side: 'bottom', pos: 2}); // 底部，连接左侧仓库
        }
        
        // 观察点 (45, 15, 5, 5) - 左边界在x=45
        if (roomX === 45 && roomY === 15) {
            // 走廊 { x: 40, y: 17, width: 5, height: 1 } - 水平走廊
            doorways.push({side: 'left', pos: 2}); // 左侧，连接右侧军械库
            // 走廊 { x: 45, y: 20, width: 1, height: 6 } - 競直走廊
            doorways.push({side: 'bottom', pos: 2}); // 底部，连接下方
        }
        
        // 补给站 (24, 5, 8, 5) - 底部在y=10
        if (roomX === 24 && roomY === 5) {
            // 走廊 { x: 20, y: 5, width: 4, height: 1 } - 左侧走廊
            doorways.push({side: 'left', pos: 0}); // 左侧，连接起始房间
            // 走廊 { x: 28, y: 10, width: 1, height: 5 } - 下方垂直走廊
            doorways.push({side: 'bottom', pos: 4}); // 底部，连接中央大厅
        }
        
        // 左侧仓库 (10, 22, 8, 6) - 顶部在y=22
        if (roomX === 10 && roomY === 22) {
            // 走廊 { x: 10, y: 20, width: 4, height: 1 } - 上方走廊
            doorways.push({side: 'top', pos: 1}); // 顶部，连接安全屋
            // 走廊 { x: 14, y: 22, width: 1, height: 6 } - 右侧垂直走廊
            doorways.push({side: 'right', pos: 0}); // 右侧，连接起始房间附近
            // 走廊 { x: 14, y: 28, width: 10, height: 1 } - 底部走廊
            doorways.push({side: 'bottom', pos: 4}); // 底部，连接宝藏房间
        }
        
        return doorways;
    }
    
    // 为房间创建墙壁 - 接受网格尺寸参数，支持门口（旧版本，保留作为备份）
    private createRoomWalls(x: number, y: number, width: number, height: number, color: number, gridSize: number) {
        // 使用传入的网格尺寸，确保墙壁与地图其他元素对齐
        const wallWidth = gridSize;
        const wallHeight = gridSize;
        
        // 获取门口位置
        const doorways = this.getDoorwayPositions(x, y, width, height);
        
        // 创建墙壁位置数组，但排除门口位置
        const wallPositions = [
            { wx: x, wy: y, w: width, h: 1, side: 'top' },         // 顶部
            { wx: x, wy: y + height - 1, w: width, h: 1, side: 'bottom' }, // 底部
            { wx: x, wy: y, w: 1, h: height, side: 'left' },         // 左侧
            { wx: x + width - 1, wy: y, w: 1, h: height, side: 'right' }  // 右侧
        ];
        
        wallPositions.forEach(pos => {
            // 检查这一侧是否有门口
            const sideDoorways = doorways.filter(d => d.side === pos.side);
            
            // 如果有门口，分段创建墙壁
            if (sideDoorways.length > 0) {
                let currentPos = 0;
                sideDoorways.forEach((doorway, index) => {
                    // 创建门口前的墙壁
                    if (doorway.pos > currentPos) {
                        const segmentLength = doorway.pos - currentPos;
                        this.createWallSegmentWithDoor(pos, currentPos, segmentLength, gridSize, color);
                    }
                    currentPos = doorway.pos + 1; // 门口宽度为1个网格单位
                });
                // 创建最后一段墙壁
                const totalLength = pos.side === 'top' || pos.side === 'bottom' ? pos.w : pos.h;
                if (currentPos < totalLength) {
                    this.createWallSegmentWithDoor(pos, currentPos, totalLength - currentPos, gridSize, color);
                }
            } else {
                // 没有门口，创建整面墙壁
                this.createWallSegmentWithDoor(pos, 0, pos.side === 'top' || pos.side === 'bottom' ? pos.w : pos.h, gridSize, color);
            }
        });
    }
    
    // 创建墙壁段（支持分段创建以留出门口）
    private createWallSegmentWithDoor(pos: {wx: number, wy: number, w: number, h: number, side: string}, startOffset: number, length: number, gridSize: number, color: number) {
        if (length <= 0) return; // 跳过空段
        
        const wallWidth = gridSize;
        const wallHeight = gridSize;
        
        let gridX: number, gridY: number, totalWidth: number, totalHeight: number;
        
        if (pos.side === 'top' || pos.side === 'bottom') {
            // 水平墙壁
            gridX = (pos.wx + startOffset) * wallWidth;
            gridY = pos.wy * wallHeight;
            totalWidth = length * wallWidth;
            totalHeight = pos.h * wallHeight;
        } else {
            // 垂直墙壁
            gridX = pos.wx * wallWidth;
            gridY = (pos.wy + startOffset) * wallHeight;
            totalWidth = pos.w * wallWidth;
            totalHeight = length * wallHeight;
        }
        
        // 创建墙壁图形
        const wallGraphic = this.add.graphics();
        
        // 墙壁主体 - 深色底层
        wallGraphic.fillStyle(0x2a2a2a, 1); // 深灰色底层
        wallGraphic.fillRect(0, 0, totalWidth, totalHeight);
        
        // 墙壁上层 - 使用房间颜色但更亮
        const wallColor = color || 0x555555;
        wallGraphic.fillStyle(wallColor, 0.9); // 使用房间颜色，高不透明度
        wallGraphic.fillRect(3, 3, totalWidth - 6, totalHeight - 6);
        
        // 添加墙壁纹理 - 砖块效果
        this.drawBrickTexture(wallGraphic, 0, 0, totalWidth, totalHeight, color);
        
        // 墙壁边框
        wallGraphic.lineStyle(3, color - 0x222222, 1);
        wallGraphic.strokeRect(0, 0, totalWidth, totalHeight);
        
        // 添加一些随机的墙壁细节
        this.addWallDetails(wallGraphic, 0, 0, totalWidth, totalHeight, color);
        
        wallGraphic.setPosition(gridX, gridY);
        wallGraphic.setDepth(50);
        wallGraphic.setVisible(true);
        wallGraphic.setScrollFactor(1, 1); // 确保跟随相机
        
        // 添加墙壁阴影效果
        const shadowGraphic = this.add.graphics();
        shadowGraphic.fillStyle(0x000000, 0.3);
        shadowGraphic.fillRect(0, 0, totalWidth, 5);
        shadowGraphic.fillRect(totalWidth - 5, 0, 5, totalHeight);
        shadowGraphic.setPosition(gridX, gridY);
        shadowGraphic.setDepth(49);
        shadowGraphic.setVisible(true);
        shadowGraphic.setScrollFactor(1, 1); // 确保跟随相机
        
        // 创建对应的物理碰撞体 - 修复偏移问题
        const wall = this.walls.create(gridX, gridY, '');
        if (wall && wall.body) {
            const body = wall.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(totalWidth, totalHeight);
            body.immovable = true;
            // 正确设置偏移：从(0,0)开始
            body.setOffset(0, 0);
        }
    }
    
    // 绘制砖块纹理
    private drawBrickTexture(graphic: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, baseColor: number) {
        const brickHeight = 20;
        const brickWidth = 40;
        
        // 砖块线条
        graphic.lineStyle(1, baseColor - 0x111111, 0.6);
        
        // 绘制水平砖块线
        for (let i = brickHeight; i < height; i += brickHeight) {
            let offset = (i / brickHeight) % 2 === 0 ? 0 : brickWidth / 2;
            
            // 绘制砖块分隔线
            graphic.beginPath();
            graphic.moveTo(x, y + i);
            graphic.lineTo(x + width, y + i);
            graphic.stroke();
            
            // 绘制垂直砖块线
            for (let j = offset; j < width; j += brickWidth) {
                graphic.beginPath();
                graphic.moveTo(x + j, y + Math.max(0, i - brickHeight));
                graphic.lineTo(x + j, y + i);
                graphic.stroke();
            }
        }
    }
    
    // 添加墙壁细节
    private addWallDetails(graphic: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number) {
        // 随机添加一些凹痕和细节
        const detailCount = Math.floor((width + height) / 100);
        
        for (let i = 0; i < detailCount; i++) {
            // 随机方向
            const detailX = x + Math.random() * (width - 40);
            const detailY = y + Math.random() * (height - 40);
            const detailWidth = Math.random() * 30 + 10;
            const detailHeight = Math.random() * 10 + 5;
            
            graphic.fillStyle(color - 0x222222, 0.8);
            graphic.fillRect(detailX, detailY, detailWidth, detailHeight);
            
            // 添加一些突出的细节
            if (Math.random() > 0.7) {
                graphic.fillStyle(color + 0x111111, 1);
                graphic.fillRect(detailX + 2, detailY + 2, detailWidth - 4, detailHeight - 4);
            }
        }
    }
    
    // 添加地板图案
    private addFloorPattern(graphic: Phaser.GameObjects.Graphics, roomType: string, width: number, height: number) {
        switch (roomType) {
            case 'start':
                // 起始房间 - 棋盘格图案（更明显）
                this.drawCheckerboardPattern(graphic, 0, 0, width, height, 0x7A9FBF, 0.5);
                break;
            case 'main':
                // 中央大厅 - 辐射状图案（更明显）
                this.drawRadialPattern(graphic, width/2, height/2, width, height, 0x8D6047, 0.4);
                break;
            case 'treasure':
                // 宝藏房间 - 金色线条图案（更明显）
                this.drawGoldenPattern(graphic, 0, 0, width, height, 0xFFD700, 0.5);
                break;
            case 'evac':
                // 撤离点 - 绿色网格（更明显）
                this.drawGridPattern(graphic, 0, 0, width, height, 0x4EAD52, 0.5);
                break;
            default:
                // 其他房间 - 简单线条
                graphic.lineStyle(1, 0x444444, 0.2);
                for (let i = 0; i < width; i += 80) {
                    for (let j = 0; j < height; j += 80) {
                        graphic.beginPath();
                        graphic.moveTo(i, j);
                        graphic.lineTo(i + 80, j + 80);
                        graphic.stroke();
                    }
                }
        }
    }
    
    // 绘制棋盘格图案
    private drawCheckerboardPattern(graphic: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number, alpha: number) {
        const tileSize = 40;
        graphic.fillStyle(color, alpha);
        
        for (let i = 0; i < width; i += tileSize) {
            for (let j = 0; j < height; j += tileSize) {
                if ((i/tileSize + j/tileSize) % 2 === 0) {
                    graphic.fillRect(x + i, y + j, tileSize, tileSize);
                }
            }
        }
    }
    
    // 绘制辐射状图案
    private drawRadialPattern(graphic: Phaser.GameObjects.Graphics, centerX: number, centerY: number, width: number, height: number, color: number, alpha: number) {
        graphic.lineStyle(1, color, alpha);
        
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            graphic.beginPath();
            graphic.moveTo(centerX, centerY);
            graphic.lineTo(
                centerX + Math.cos(angle) * width,
                centerY + Math.sin(angle) * height
            );
            graphic.stroke();
        }
        
        // 同心圆
        for (let radius = 40; radius < Math.min(width, height) / 2; radius += 40) {
            graphic.beginPath();
            graphic.arc(centerX, centerY, radius, 0, Math.PI * 2);
            graphic.stroke();
        }
    }
    
    // 绘制金色图案
    private drawGoldenPattern(graphic: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number, alpha: number) {
        graphic.lineStyle(2, color, alpha);
        
        // 绘制对角线
        graphic.beginPath();
        graphic.moveTo(x, y);
        graphic.lineTo(x + width, y + height);
        graphic.stroke();
        
        graphic.beginPath();
        graphic.moveTo(x + width, y);
        graphic.lineTo(x, y + height);
        graphic.stroke();
        
        // 绘制装饰性星星
        const starCount = 5;
        for (let i = 0; i < starCount; i++) {
            const starX = x + Math.random() * width;
            const starY = y + Math.random() * height;
            const size = Math.random() * 10 + 5;
            this.drawStar(graphic, starX, starY, size, size * 0.6);
        }
    }
    

    // 绘制网格图案
    private drawGridPattern(graphic: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number, alpha: number) {
        graphic.lineStyle(2, color, alpha);
        
        // 绘制十字线
        graphic.beginPath();
        graphic.moveTo(x, y + height/2);
        graphic.lineTo(x + width, y + height/2);
        graphic.stroke();
        
        graphic.beginPath();
        graphic.moveTo(x + width/2, y);
        graphic.lineTo(x + width/2, y + height);
        graphic.stroke();
        
        // 绘制外框
        graphic.strokeRect(x + 10, y + 10, width - 20, height - 20);
    }
    
    // 创建特殊区域
    private createSpecialAreas() {
        // 创建危险区域（辐射区）
        const dangerZones = [
            { x: 480, y: 520, radius: 100, color: 0xff0000 }
        ];
        
        dangerZones.forEach(zone => {
            // 危险区域效果
            const dangerGraphic = this.add.graphics();
            dangerGraphic.fillStyle(zone.color, 0.2);
            dangerGraphic.fillCircle(0, 0, zone.radius);
            dangerGraphic.setPosition(zone.x, zone.y);
            dangerGraphic.setDepth(-45);
            
            // 脉冲动画
            this.tweens.add({
                targets: dangerGraphic,
                alpha: [0.2, 0.4, 0.2],
                duration: 2000,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // 添加警告标记
            const warningText = this.add.text(zone.x, zone.y, '危险!', {
                fontSize: '16px',
                color: '#ff0000',
                // // fontWeight: 'bold'
            });
            warningText.setOrigin(0.5);
            warningText.setDepth(60);
        });
    }
    
    // 添加装饰性物体
    private addDecorativeObjects(rooms: any[], corridors: any[], gridSize: number) {
        // 在房间中添加箱子、货架等物体
        rooms.forEach(room => {
            const roomX = room.x * gridSize;
            const roomY = room.y * gridSize;
            const roomW = room.width * gridSize;
            const roomH = room.height * gridSize;
            
            // 根据房间类型添加不同的物体
            switch (room.type) {
                case 'start':
                    // 添加一些补给箱
                    this.addSupplyCrate(roomX + 60, roomY + 60);
                    this.addSupplyCrate(roomX + roomW - 60, roomY + roomH - 60);
                    // 添加战术桌子和椅子
                    this.addTable(roomX + roomW/2, roomY + roomH - 80);
                    this.addChair(roomX + roomW/2 - 40, roomY + roomH - 60);
                    this.addChair(roomX + roomW/2 + 40, roomY + roomH - 60);
                    // 添加一些装饰物
                    this.addComputer(roomX + 100, roomY + 100);
                    break;
                    
                case 'main':
                    // 添加柱子和货架
                    for (let i = 0; i < 4; i++) {
                        const colX = roomX + gridSize * (1 + i * 2);
                        const colY = roomY + gridSize * 2;
                        this.addColumn(colX, colY);
                    }
                    
                    // 添加货架
                    this.addShelf(roomX + 100, roomY + 100);
                    this.addShelf(roomX + roomW - 100, roomY + 100);
                    // 添加更多装饰：战术桌、控制台等
                    this.addTable(roomX + roomW/2, roomY + roomH/2);
                    this.addControlPanel(roomX + roomW/2, roomY + 80);
                    // 添加一些箱子
                    this.addStorageBox(roomX + 150, roomY + roomH - 60);
                    this.addStorageBox(roomX + roomW - 150, roomY + roomH - 60);
                    break;
                    
                case 'side':
                    // 添加货架和储物柜
                    const shelfCount = Math.floor(Math.random() * 3) + 2;
                    for (let i = 0; i < shelfCount; i++) {
                        const shelfX = roomX + 50 + (i * 100);
                        const shelfY = roomY + roomH - 60;
                        if (shelfX < roomX + roomW - 50) {
                            this.addShelf(shelfX, shelfY);
                        }
                    }
                    // 添加更多储物箱
                    for (let i = 0; i < 2; i++) {
                        const boxX = roomX + 80 + (i * 120);
                        const boxY = roomY + 100;
                        if (boxX < roomX + roomW - 80) {
                            this.addStorageBox(boxX, boxY);
                        }
                    }
                    // 添加一些杂物
                    this.addDebris(roomX + roomW/2, roomY + roomH/2);
                    break;
                    
                case 'treasure':
                    // 添加多个宝箱
                    this.addTreasureChest(roomX + roomW/2 - 60, roomY + roomH/2);
                    this.addTreasureChest(roomX + roomW/2 + 60, roomY + roomH/2);
                    // 添加装饰性柱子
                    this.addColumn(roomX + 100, roomY + 100);
                    this.addColumn(roomX + roomW - 100, roomY + 100);
                    // 添加一些金币堆
                    this.addCoinPile(roomX + roomW/2, roomY + roomH/2 - 50);
                    break;
                    
                case 'evac':
                    // 添加撤离点标记和设备
                    this.addEvacuationEquipment(roomX + roomW/2, roomY + roomH/2);
                    // 添加控制台
                    this.addControlPanel(roomX + roomW/2, roomY + 100);
                    // 添加一些设备箱
                    this.addEquipmentBox(roomX + roomW/2 - 80, roomY + roomH - 60);
                    this.addEquipmentBox(roomX + roomW/2 + 80, roomY + roomH - 60);
                    break;
            }
        });
        
        // 在走廊添加一些杂物
        corridors.forEach(corridor => {
            if (Math.random() > 0.7) { // 30%概率添加杂物
                const corridorX = corridor.x * gridSize;
                const corridorY = corridor.y * gridSize;
                const corridorW = corridor.width * gridSize;
                const corridorH = corridor.height * gridSize;
                
                const debrisX = corridorX + Math.random() * (corridorW - 80) + 40;
                const debrisY = corridorY + Math.random() * (corridorH - 40) + 20;
                
                this.addDebris(debrisX, debrisY);
            }
        });
    }
    
    // 添加补给箱 - 精美的设计
    private addSupplyCrate(x: number, y: number) {
        const crate = this.add.graphics();
        
        // 箱子阴影
        crate.fillStyle(0x2a2a2a, 0.6);
        crate.fillEllipse(0, 5, 55, 15);
        
        // 箱子主体 - 3D效果
        crate.fillStyle(0x654321, 1);
        crate.fillRect(-25, -20, 50, 40);
        
        // 顶部高光
        crate.fillStyle(0x8B4513, 1);
        crate.fillRect(-25, -20, 50, 15);
        
        // 侧面阴影
        crate.fillStyle(0x4a3a2a, 1);
        crate.fillRect(-25, 5, 12, 35);
        
        // 箱子边框
        crate.lineStyle(3, 0x444444, 1);
        crate.strokeRect(-25, -20, 50, 40);
        
        // 箱子细节 - 木板纹理
        crate.lineStyle(1, 0x5a4a3a, 0.8);
        for (let i = 0; i < 3; i++) {
            crate.beginPath();
            crate.moveTo(-25 + i * 25, -20);
            crate.lineTo(-25 + i * 25, 20);
            crate.stroke();
        }
        
        // 金属扣件
        crate.fillStyle(0x888888, 1);
        crate.fillRect(-20, -15, 8, 3);
        crate.fillRect(12, -15, 8, 3);
        crate.fillRect(-20, 12, 8, 3);
        crate.fillRect(12, 12, 8, 3);
        
        // 顶部标签
        crate.fillStyle(0x2ecc71, 1);
        crate.fillRoundedRect(-15, -25, 30, 8, 2);
        crate.lineStyle(1, 0x27ae60, 1);
        crate.strokeRoundedRect(-15, -25, 30, 8, 2);
        
        crate.setPosition(x, y);
        crate.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(50, 40);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加柱子 - 精美的设计
    private addColumn(x: number, y: number) {
        const column = this.add.graphics();
        
        // 柱子阴影
        column.fillStyle(0x2a2a2a, 0.5);
        column.fillEllipse(0, 35, 45, 15);
        
        // 柱子主体 - 圆柱形效果
        column.fillStyle(0x6D4C41, 1);
        column.fillCircle(0, 0, 20);
        
        // 柱子高光
        column.fillStyle(0x8D6C61, 0.8);
        column.fillCircle(-5, -20, 15);
        
        // 柱子阴影面
        column.fillStyle(0x5D3C31, 0.8);
        column.fillCircle(5, 20, 15);
        
        // 柱子纹理 - 纵向线条
        column.lineStyle(2, 0x8D6C61, 0.6);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            column.beginPath();
            column.moveTo(0, 0);
            column.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
            column.stroke();
        }
        
        // 柱子顶部装饰 - 圆盘
        column.fillStyle(0x8D6C61, 1);
        column.fillCircle(0, -30, 22);
        column.lineStyle(2, 0x6D4C41, 1);
        column.strokeCircle(0, -30, 22);
        
        // 顶部装饰细节
        column.fillStyle(0x9D7C71, 1);
        column.fillCircle(0, -30, 18);
        
        // 底部基座
        column.fillStyle(0x5D3C31, 1);
        column.fillCircle(0, 30, 22);
        column.lineStyle(2, 0x4D2C21, 1);
        column.strokeCircle(0, 30, 22);
        
        column.setPosition(x, y);
        column.setDepth(55);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(40, 60);
        body.setImmovable(true);
        body.setDepth(55);
    }
    
    // 添加货架 - 精美的设计
    private addShelf(x: number, y: number) {
        const shelf = this.add.graphics();
        
        // 货架阴影
        shelf.fillStyle(0x2a2a2a, 0.5);
        shelf.fillEllipse(0, 25, 65, 15);
        
        // 货架主体 - 3D效果
        shelf.fillStyle(0x8B4513, 1);
        shelf.fillRect(-30, -20, 60, 40);
        
        // 顶部高光
        shelf.fillStyle(0x9B5533, 1);
        shelf.fillRect(-30, -20, 60, 8);
        
        // 侧面阴影
        shelf.fillStyle(0x6B3513, 1);
        shelf.fillRect(-30, -12, 8, 32);
        
        // 货架层板 - 多层设计
        shelf.fillStyle(0x654321, 1);
        shelf.fillRect(-28, -5, 56, 4);
        shelf.fillRect(-28, 8, 56, 4);
        
        // 层板高光
        shelf.fillStyle(0x754321, 0.8);
        shelf.fillRect(-28, -5, 56, 2);
        shelf.fillRect(-28, 8, 56, 2);
        
        // 货架支柱 - 更粗更明显
        shelf.fillStyle(0x553311, 1);
        shelf.fillRect(-30, -20, 6, 40);
        shelf.fillRect(24, -20, 6, 40);
        
        // 支柱装饰
        shelf.fillStyle(0x653311, 1);
        shelf.fillRect(-29, -20, 4, 40);
        shelf.fillRect(25, -20, 4, 40);
        
        // 添加物品 - 更精美的设计
        // 蓝色物品（圆形）
        shelf.fillStyle(0x3498db, 0.9);
        shelf.fillCircle(-17, 10, 6);
        shelf.lineStyle(1, 0x2874a6, 1);
        shelf.strokeCircle(-17, 10, 6);
        
        // 红色物品（方形）
        shelf.fillStyle(0xe74c3c, 0.9);
        shelf.fillRoundedRect(3, 6, 12, 12, 2);
        shelf.lineStyle(1, 0xc0392b, 1);
        shelf.strokeRoundedRect(3, 6, 12, 12, 2);
        
        // 绿色物品（三角形）
        shelf.fillStyle(0x2ecc71, 0.9);
        shelf.beginPath();
        shelf.moveTo(-17, -11);
        shelf.lineTo(-9, -11);
        shelf.lineTo(-13, -17);
        shelf.closePath();
        shelf.fill();
        shelf.lineStyle(1, 0x27ae60, 1);
        shelf.strokePath();
        
        // 边框
        shelf.lineStyle(2, 0x553311, 1);
        shelf.strokeRect(-30, -20, 60, 40);
        
        shelf.setPosition(x, y);
        shelf.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(60, 40);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加宝箱
    private addTreasureChest(x: number, y: number) {
        const chest = this.add.graphics();
        
        // 宝箱主体
        chest.fillStyle(0x8B4513, 1);
        chest.fillRect(-25, -15, 50, 30);
        
        // 宝箱盖子
        chest.fillStyle(0xCD853F, 1);
        chest.fillRect(-25, -15, 50, 10);
        
        // 宝箱细节
        chest.lineStyle(2, 0xA0522D, 1);
        chest.strokeRect(-25, -15, 50, 30);
        
        // 宝箱装饰
        chest.fillStyle(0xFFD700, 1);
        chest.fillCircle(-15, -15, 3);
        chest.fillCircle(0, -15, 3);
        chest.fillCircle(15, -15, 3);
        
        chest.setPosition(x, y);
        chest.setDepth(52);
        
        // 添加发光效果
        const glow = this.add.graphics();
        glow.fillStyle(0xFFD700, 0.3);
        glow.fillCircle(0, 0, 30);
        glow.setPosition(x, y);
        glow.setDepth(51);
        
        // 添加脉冲动画
        this.tweens.add({
            targets: glow,
            alpha: [0.3, 0.5, 0.3],
            duration: 2000,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(50, 30);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加撤离设备
    private addEvacuationEquipment(x: number, y: number) {
        const equipment = this.add.graphics();
        
        // 设备底座
        equipment.fillStyle(0x2c3e50, 1);
        equipment.fillRect(-40, -20, 80, 40);
        
        // 控制面板
        equipment.fillStyle(0x34495e, 1);
        equipment.fillRect(-30, -15, 60, 30);
        
        // 指示灯
        equipment.fillStyle(0x2ecc71, 1);
        equipment.fillCircle(0, 0, 10);
        
        // 按钮
        equipment.fillStyle(0x3498db, 1);
        equipment.fillCircle(-15, -10, 5);
        equipment.fillCircle(15, -10, 5);
        
        equipment.setPosition(x, y);
        equipment.setDepth(52);
        
        // 添加绿色光环
        const aura = this.add.graphics();
        aura.fillStyle(0x2ecc71, 0.3);
        aura.fillCircle(0, 0, 50);
        aura.setPosition(x, y);
        aura.setDepth(51);
        
        // 呼吸动画
        this.tweens.add({
            targets: aura,
            scale: [1, 1.2, 1],
            duration: 3000,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(80, 40);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加杂物 - 精美的设计
    private addDebris(x: number, y: number) {
        const debris = this.add.graphics();
        
        // 杂物阴影
        debris.fillStyle(0x1a1a1a, 0.5);
        debris.fillEllipse(0, 12, 45, 12);
        
        // 杂物堆主体 - 不规则形状
        debris.fillStyle(0x555555, 1);
        debris.beginPath();
        debris.moveTo(-20, 0);
        debris.lineTo(-15, -10);
        debris.lineTo(5, -8);
        debris.lineTo(18, -5);
        debris.lineTo(20, 5);
        debris.lineTo(15, 12);
        debris.lineTo(-10, 10);
        debris.closePath();
        debris.fill();
        
        // 杂物细节 - 多个不规则碎片
        debris.fillStyle(0x666666, 1);
        debris.fillRect(-15, -5, 8, 8);
        debris.fillCircle(8, -3, 5);
        debris.fillRect(5, 3, 10, 6);
        
        // 金属碎片
        debris.fillStyle(0x888888, 1);
        debris.fillRect(-8, 2, 6, 4);
        debris.fillCircle(12, 5, 3);
        
        // 边框
        debris.lineStyle(1, 0x444444, 0.8);
        debris.beginPath();
        debris.moveTo(-20, 0);
        debris.lineTo(-15, -10);
        debris.lineTo(5, -8);
        debris.lineTo(18, -5);
        debris.lineTo(20, 5);
        debris.lineTo(15, 12);
        debris.lineTo(-10, 10);
        debris.closePath();
        debris.stroke();
        
        debris.setPosition(x, y);
        debris.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(40, 20);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加桌子
    private addTable(x: number, y: number) {
        const table = this.add.graphics();
        
        // 桌子阴影
        table.fillStyle(0x2a2a2a, 0.5);
        table.fillEllipse(0, 15, 80, 20);
        
        // 桌面
        table.fillStyle(0x654321, 1);
        table.fillRect(-40, -10, 80, 20);
        
        // 桌面高光
        table.fillStyle(0x8B4513, 0.8);
        table.fillRect(-40, -10, 80, 8);
        
        // 桌腿
        table.fillStyle(0x4a3a2a, 1);
        table.fillRect(-35, 10, 8, 25);
        table.fillRect(27, 10, 8, 25);
        table.fillRect(-35, 10, 8, 25);
        table.fillRect(27, 10, 8, 25);
        
        // 边框
        table.lineStyle(2, 0x444444, 1);
        table.strokeRect(-40, -10, 80, 20);
        
        table.setPosition(x, y);
        table.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(80, 20);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加椅子
    private addChair(x: number, y: number) {
        const chair = this.add.graphics();
        
        // 椅子座面
        chair.fillStyle(0x5D4037, 1);
        chair.fillRect(-15, -5, 30, 8);
        
        // 椅子靠背
        chair.fillStyle(0x6D4C41, 1);
        chair.fillRect(-15, -18, 30, 13);
        
        // 椅子腿
        chair.fillStyle(0x4a3a2a, 1);
        chair.fillRect(-12, 3, 5, 20);
        chair.fillRect(7, 3, 5, 20);
        
        // 边框
        chair.lineStyle(1, 0x444444, 1);
        chair.strokeRect(-15, -18, 30, 26);
        
        chair.setPosition(x, y);
        chair.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(30, 25);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加电脑
    private addComputer(x: number, y: number) {
        const computer = this.add.graphics();
        
        // 显示器底座
        computer.fillStyle(0x2c3e50, 1);
        computer.fillRect(-20, 15, 40, 8);
        
        // 显示器支架
        computer.fillStyle(0x34495e, 1);
        computer.fillRect(-3, 8, 6, 10);
        
        // 显示器屏幕
        computer.fillStyle(0x1a1a1a, 1);
        computer.fillRect(-25, -20, 50, 28);
        
        // 屏幕高光
        computer.fillStyle(0x2ecc71, 0.3);
        computer.fillRect(-20, -15, 40, 18);
        
        // 屏幕边框
        computer.lineStyle(2, 0x3498db, 1);
        computer.strokeRect(-25, -20, 50, 28);
        
        // 键盘
        computer.fillStyle(0x34495e, 1);
        computer.fillRect(-30, 8, 60, 8);
        
        computer.setPosition(x, y);
        computer.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(60, 30);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加控制面板
    private addControlPanel(x: number, y: number) {
        const panel = this.add.graphics();
        
        // 面板底座
        panel.fillStyle(0x2c3e50, 1);
        panel.fillRect(-35, -15, 70, 30);
        
        // 控制面板主体
        panel.fillStyle(0x34495e, 1);
        panel.fillRect(-30, -12, 60, 24);
        
        // 按钮
        panel.fillStyle(0x2ecc71, 1);
        panel.fillCircle(-15, -5, 4);
        panel.fillCircle(0, -5, 4);
        panel.fillCircle(15, -5, 4);
        
        // 指示灯
        panel.fillStyle(0xe74c3c, 1);
        panel.fillCircle(0, 5, 3);
        
        // 屏幕
        panel.fillStyle(0x1a1a1a, 1);
        panel.fillRect(-20, 0, 40, 8);
        
        // 边框
        panel.lineStyle(2, 0x3498db, 1);
        panel.strokeRect(-35, -15, 70, 30);
        
        panel.setPosition(x, y);
        panel.setDepth(52);
        
        // 添加发光效果
        const glow = this.add.graphics();
        glow.fillStyle(0x3498db, 0.2);
        glow.fillCircle(0, 0, 40);
        glow.setPosition(x, y);
        glow.setDepth(51);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(70, 30);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加设备箱
    private addEquipmentBox(x: number, y: number) {
        const box = this.add.graphics();
        
        // 箱子阴影
        box.fillStyle(0x2a2a2a, 0.6);
        box.fillEllipse(0, 8, 55, 15);
        
        // 箱子主体
        box.fillStyle(0x34495e, 1);
        box.fillRect(-25, -18, 50, 36);
        
        // 顶部高光
        box.fillStyle(0x3498db, 0.8);
        box.fillRect(-25, -18, 50, 12);
        
        // 侧面阴影
        box.fillStyle(0x2c3e50, 1);
        box.fillRect(-25, -6, 10, 24);
        
        // 金属边框
        box.lineStyle(2, 0x3498db, 1);
        box.strokeRect(-25, -18, 50, 36);
        
        // 标签
        box.fillStyle(0x2ecc71, 1);
        box.fillRect(-15, -16, 30, 6);
        
        box.setPosition(x, y);
        box.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(50, 36);
        body.setImmovable(true);
        body.setDepth(52);
    }
    
    // 添加金币堆
    private addCoinPile(x: number, y: number) {
        const coins = this.add.graphics();
        
        // 金币堆主体
        coins.fillStyle(0xFFD700, 1);
        coins.fillCircle(0, 0, 15);
        coins.fillCircle(-8, 5, 10);
        coins.fillCircle(8, 5, 10);
        coins.fillCircle(-5, 10, 8);
        coins.fillCircle(5, 10, 8);
        
        // 金币高光
        coins.fillStyle(0xFFED4E, 1);
        coins.fillCircle(-2, -2, 5);
        coins.fillCircle(-8, 5, 4);
        coins.fillCircle(8, 5, 4);
        
        // 金币边框
        coins.lineStyle(1, 0xFFA500, 1);
        coins.strokeCircle(0, 0, 15);
        coins.strokeCircle(-8, 5, 10);
        coins.strokeCircle(8, 5, 10);
        
        coins.setPosition(x, y);
        coins.setDepth(52);
        
        // 添加发光效果
        const glow = this.add.graphics();
        glow.fillStyle(0xFFD700, 0.3);
        glow.fillCircle(0, 0, 25);
        glow.setPosition(x, y);
        glow.setDepth(51);
        
        // 添加脉冲动画
        this.tweens.add({
            targets: glow,
            alpha: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1],
            duration: 1500,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(30, 25);
        body.setImmovable(true);
        body.setDepth(52);
    }
    

    
    // 添加灰尘效果
    private addDustEffects() {
        const dustParticles = this.add.group();
        
        // 创建灰尘粒子
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const particle = this.add.circle(0, 0, Math.random() * 3 + 1, 0x999999, 0.5);
                particle.x = Math.random() * 1500;
                particle.y = Math.random() * 1200;
                particle.visible = true;
                dustParticles.add(particle);
                
                // 缓慢移动的动画
                this.tweens.add({
                    targets: particle,
                    y: particle.y - Math.random() * 200,
                    alpha: { from: 0.5, to: 0 },
                    duration: 5000 + Math.random() * 10000,
                    repeat: -1,
                    delay: Math.random() * 5000
                });
            }, i * 200);
        }
    }
    
    // 添加动态光效
    private addDynamicLights() {
        const dynamicLights = [
            { x: 400, y: 400, radius: 100, color: 0xffff00, speed: 5000 },
            { x: 800, y: 600, radius: 150, color: 0xff8800, speed: 7000 },
            { x: 1200, y: 400, radius: 120, color: 0xff00ff, speed: 6000 }
        ];
        
        dynamicLights.forEach(light => {
            const lightGraphic = this.add.graphics();
            lightGraphic.fillStyle(light.color, 0.2);
            lightGraphic.fillCircle(0, 0, light.radius);
            lightGraphic.setPosition(light.x, light.y);
            lightGraphic.setDepth(-48);
            
            // 随机移动和闪烁
            this.tweens.add({
                targets: lightGraphic,
                x: light.x + (Math.random() * 200 - 100),
                y: light.y + (Math.random() * 200 - 100),
                alpha: [0.1, 0.3, 0.1],
                duration: light.speed,
                repeat: -1,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        });
    }
    
    // 添加雾气效果
    private addFogEffects() {
        const fogLayers = 3;
        
        for (let i = 0; i < fogLayers; i++) {
            const fog = this.add.graphics();
            fog.fillStyle(0x0a0a0a, 0.05 + (i * 0.02));
            fog.fillRect(0, 0, 1500, 1200);
            fog.setDepth(-49 + i);
            
            // 缓慢移动的雾气
            this.tweens.add({
                targets: fog,
                x: [0, -50, 0],
                duration: 15000 + (i * 5000),
                repeat: -1,
                ease: 'Linear'
            });
        }
    }
    
    // 创建走廊墙壁 - 完整版本，确保走廊有墙壁限制
    // 创建墙壁段
    private createWallSegment(x: number, y: number, width: number, height: number, color: number, gridSize: number) {
        const wallWidth = gridSize;
        const wallHeight = gridSize;
        
        const gridX = x * wallWidth;
        const gridY = y * wallHeight;
        const totalWidth = width * wallWidth;
        const totalHeight = height * wallHeight;
        
        // 创建墙壁图形 - 加强可见性
        const wallGraphic = this.add.graphics();
        
        // 深色底层
        wallGraphic.fillStyle(0x1a1a1a, 1);
        wallGraphic.fillRect(0, 0, totalWidth, totalHeight);
        
        // 墙壁主体
        wallGraphic.fillStyle(color, 1);
        wallGraphic.fillRect(2, 2, totalWidth - 4, totalHeight - 4);
        
        // 墙壁边框
        wallGraphic.lineStyle(3, color + 0x222222, 1);
        wallGraphic.strokeRect(0, 0, totalWidth, totalHeight);
        
        wallGraphic.setPosition(gridX, gridY);
        wallGraphic.setDepth(50);
        wallGraphic.setVisible(true);
        wallGraphic.setScrollFactor(1, 1);
        
        // 创建物理碰撞体 - 修复偏移问题
        const wall = this.walls.create(gridX, gridY, '');
        if (wall && wall.body) {
            const body = wall.body as Phaser.Physics.Arcade.StaticBody;
            body.setSize(totalWidth, totalHeight);
            body.immovable = true;
            // 正确设置偏移：从(0,0)开始
            body.setOffset(0, 0);
            
            console.log(`墙壁创建: 位置(${gridX}, ${gridY}), 尺寸(${totalWidth}x${totalHeight})`);
        }
    }
    
    // 所有走廊生成相关方法已删除
    // 创建外围墙壁 - 防止玩家移动到地图外面
    private createOuterWalls(rooms: any[], corridors: any[], gridSize: number) {
        // 找到地图边界
        let minX = Number.MAX_VALUE;
        let minY = Number.MAX_VALUE;
        let maxX = 0;
        let maxY = 0;
        
        rooms.forEach(area => {
            minX = Math.min(minX, area.x - 2);
            minY = Math.min(minY, area.y - 2);
            maxX = Math.max(maxX, area.x + area.width + 2);
            maxY = Math.max(maxY, area.y + area.height + 2);
        });
        
        const outerWallColor = 0x2a2a2a; // 深灰色
        const thickness = 3; // 增加墙壁厚度
        
        // 顶部墙壁
        this.createWallSegment(minX, minY, maxX - minX, thickness, outerWallColor, gridSize);
        // 底部墙壁
        this.createWallSegment(minX, maxY - thickness, maxX - minX, thickness, outerWallColor, gridSize);
        // 左侧墙壁
        this.createWallSegment(minX, minY + thickness, thickness, maxY - minY - 2 * thickness, outerWallColor, gridSize);
        // 右侧墙壁
        this.createWallSegment(maxX - thickness, minY + thickness, thickness, maxY - minY - 2 * thickness, outerWallColor, gridSize);
        
        console.log(`外围墙壁创建完成: 范围(${minX}, ${minY}) 到 (${maxX}, ${maxY})`);
    }
    
    // 创建撤离点开关
    private createEvacuationSwitch(rooms: any[], gridSize: number) {
        try {
            // 开关位置：放在中央大厅的中心位置（固定位置）
            const mainRoom = rooms.find(r => r.name === '中央大厅');
            if (!mainRoom) {
                console.warn('找不到中央大厅，无法创建撤离点开关');
                return;
            }
            
            const switchX = (mainRoom.x + mainRoom.width / 2) * gridSize;
            const switchY = (mainRoom.y + mainRoom.height / 2) * gridSize;
            
            // 创建开关图形
            const switchGraphic = this.add.graphics();
            
            // 开关主体（红色，表示未激活）
            switchGraphic.fillStyle(0xff0000, 0.8);
            switchGraphic.fillRect(-30, -30, 60, 60);
            switchGraphic.lineStyle(4, 0xffffff, 1);
            switchGraphic.strokeRect(-30, -30, 60, 60);
            
            // 开关按钮
            switchGraphic.fillStyle(0x333333, 1);
            switchGraphic.fillRect(-15, -15, 30, 30);
            switchGraphic.lineStyle(2, 0xffffff, 1);
            switchGraphic.strokeRect(-15, -15, 30, 30);
            
            // 添加开关文字
            const switchText = this.add.text(0, 0, '撤离开关', {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: { left: 5, right: 5, top: 2, bottom: 2 }
            });
            switchText.setOrigin(0.5);
            switchText.setDepth(45);
            
            switchGraphic.setPosition(switchX, switchY);
            switchGraphic.setDepth(45);
            
            // 创建物理碰撞体用于交互检测
            const switchBody = this.interactiveObjects.create(switchX, switchY, '');
            if (switchBody && switchBody.body) {
                const body = switchBody.body as Phaser.Physics.Arcade.Body;
                body.setSize(60, 60);
                body.setOffset(-30, -30);
                body.setImmovable(true);
            }
            
            // 存储开关数据
            switchBody.setData('type', 'evacuationSwitch');
            switchBody.setData('name', '撤离点开关');
            switchBody.setData('graphic', switchGraphic);
            switchBody.setData('text', switchText);
            switchBody.setData('active', true);
            switchBody.setData('activated', false);
            
            this.evacuationSwitch = switchBody;
            
            console.log(`撤离点开关创建完成: 位置(${switchX}, ${switchY})`);
            
        } catch (error) {
            console.error('创建撤离点开关时出错:', error);
        }
    }
    
    // 检查撤离点开关交互
    private checkEvacuationSwitch() {
        try {
            if (!this.playerBody || !this.evacuationSwitch) return;
            
            const switchBody = this.evacuationSwitch;
            if (!switchBody.active || switchBody.getData('activated')) return;
            
            const distance = Phaser.Math.Distance.Between(
                this.playerBody.x, this.playerBody.y,
                switchBody.x, switchBody.y
            );
            
            const interactionDistance = 100;
            const graphic = switchBody.getData('graphic');
            const switchText = switchBody.getData('text');
            
            if (distance < interactionDistance) {
                // 玩家接近开关，显示提示
                if (switchText) {
                    switchText.setText('撤离开关\n按E键激活');
                    switchText.setVisible(true);
                    switchText.setPosition(
                        switchBody.x - this.cameras.main.scrollX,
                        switchBody.y - this.cameras.main.scrollY - 40
                    );
                    switchText.setScrollFactor(0);
                }
                
                // 高亮效果
                if (graphic && !switchBody.getData('isHighlighted')) {
                    switchBody.setData('isHighlighted', true);
                    graphic.clear();
                    graphic.fillStyle(0xff6600, 0.9);
                    graphic.fillRect(-30, -30, 60, 60);
                    graphic.lineStyle(4, 0xffff00, 1);
                    graphic.strokeRect(-30, -30, 60, 60);
                    graphic.fillStyle(0x333333, 1);
                    graphic.fillRect(-15, -15, 30, 30);
                    graphic.lineStyle(2, 0xffff00, 1);
                    graphic.strokeRect(-15, -15, 30, 30);
                }
                
                // 检测E键按下（使用justDown确保只触发一次）
                const eKey = (this.keys as any)?.e;
                if (eKey && Phaser.Input.Keyboard.JustDown(eKey)) {
                    this.activateEvacuationSwitch();
                }
            } else {
                // 玩家远离开关
                if (switchText) {
                    switchText.setVisible(false);
                }
                
                // 恢复原始外观
                if (graphic && switchBody.getData('isHighlighted')) {
                    switchBody.setData('isHighlighted', false);
                    if (!switchBody.getData('activated')) {
                        graphic.clear();
                        graphic.fillStyle(0xff0000, 0.8);
                        graphic.fillRect(-30, -30, 60, 60);
                        graphic.lineStyle(4, 0xffffff, 1);
                        graphic.strokeRect(-30, -30, 60, 60);
                        graphic.fillStyle(0x333333, 1);
                        graphic.fillRect(-15, -15, 30, 30);
                        graphic.lineStyle(2, 0xffffff, 1);
                        graphic.strokeRect(-15, -15, 30, 30);
                    }
                }
            }
        } catch (error) {
            console.error('检查撤离点开关时出错:', error);
        }
    }
    
    // 激活撤离点开关
    private activateEvacuationSwitch() {
        try {
            if (!this.evacuationSwitch || this.evacuationSwitchActivated) return;
            
            this.evacuationSwitchActivated = true;
            const switchBody = this.evacuationSwitch;
            const graphic = switchBody.getData('graphic');
            const switchText = switchBody.getData('text');
            
            // 更新开关外观（绿色，表示已激活）
            if (graphic) {
                graphic.clear();
                graphic.fillStyle(0x00ff00, 0.9);
                graphic.fillRect(-30, -30, 60, 60);
                graphic.lineStyle(4, 0xffffff, 1);
                graphic.strokeRect(-30, -30, 60, 60);
                graphic.fillStyle(0x00ff00, 1);
                graphic.fillRect(-15, -15, 30, 30);
                graphic.lineStyle(2, 0xffffff, 1);
                graphic.strokeRect(-15, -15, 30, 30);
            }
            
            if (switchText) {
                switchText.setText('撤离开关\n已激活');
                switchText.setVisible(true);
            }
            
            switchBody.setData('activated', true);
            
            // 在撤离点房间开启门口
            this.openEvacuationRoomDoorway();
            
            // 激活撤离点房间内的撤离点
            const gridSize = 80;
            const evacRoom = { x: 38, y: 22, width: 8, height: 6 };
            const evacCenterX = (evacRoom.x + evacRoom.width / 2) * gridSize;
            const evacCenterY = (evacRoom.y + evacRoom.height / 2) * gridSize;
            
            // 找到并激活撤离点房间内的撤离点
            this.evacuationPoints.forEach(evacPoint => {
                const dist = Phaser.Math.Distance.Between(
                    evacPoint.x, evacPoint.y,
                    evacCenterX, evacCenterY
                );
                // 如果撤离点在撤离点房间内（距离中心小于房间尺寸的一半）
                if (dist < Math.max(evacRoom.width, evacRoom.height) * gridSize / 2) {
                    evacPoint.active = true;
                    evacPoint.isCountdownActive = false;
                    
                    // 更新撤离点图形为激活状态
                    evacPoint.graphic.clear();
                    evacPoint.graphic.fillStyle(0x00ff00, 0.5);
                    evacPoint.graphic.fillCircle(0, 0, 30);
                    evacPoint.graphic.lineStyle(3, 0x00ff00, 1);
                    evacPoint.graphic.strokeCircle(0, 0, 30);
                }
            });
            
            // 激活撤离点系统
            this.evacuationAvailable = true;
            
            // 显示激活提示
            const notification = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY - 100,
                '撤离点已激活！\n前往撤离点房间完成撤离',
                {
                    fontSize: '24px',
                    color: '#00ff00',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: { left: 20, right: 20, top: 10, bottom: 10 },
                    align: 'center'
                }
            );
            notification.setOrigin(0.5);
            notification.setScrollFactor(0);
            notification.setDepth(1000);
            
            // 3秒后淡出
            this.tweens.add({
                targets: notification,
                alpha: { from: 1, to: 0 },
                duration: 3000,
                onComplete: () => notification.destroy()
            });
            
            console.log('撤离点开关已激活');
            
        } catch (error) {
            console.error('激活撤离点开关时出错:', error);
        }
    }
    
    // 在撤离点房间开启门口
    private openEvacuationRoomDoorway() {
        try {
            const gridSize = 80;
            // 撤离点房间位置：x: 38, y: 22, width: 8, height: 6
            const evacRoom = { x: 38, y: 22, width: 8, height: 6 };
            
            // 确定门口位置：在撤离点房间的左侧墙壁（靠近宝藏室的方向）
            // 门口宽度：3格（与原来的走廊宽度一致）
            const doorwayWidth = 3;
            const doorwayPos = Math.floor((evacRoom.height - doorwayWidth) / 2); // 在左侧墙壁的中心位置
            
            // 计算需要移除的墙壁位置（左侧墙壁）
            const wallX = evacRoom.x;
            const wallY = evacRoom.y + doorwayPos;
            const wallGridX = wallX * gridSize;
            const wallGridY = wallY * gridSize;
            
            // 找到并移除该位置的墙壁碰撞体
            const wallsToRemove: any[] = [];
            this.walls.getChildren().forEach((wall: any) => {
                if (wall.body) {
                    const wallBody = wall.body as Phaser.Physics.Arcade.StaticBody;
                    const wallWorldX = wall.x;
                    const wallWorldY = wall.y;
                    const wallWidth = wallBody.width;
                    const wallHeight = wallBody.height;
                    
                    // 检查是否在门口位置范围内（左侧墙壁，从wallY到wallY+doorwayWidth）
                    // 左侧墙壁的X坐标应该是wallGridX附近
                    if (Math.abs(wallWorldX - wallGridX) < gridSize / 2) {
                        // 检查Y坐标是否在门口范围内
                        const doorwayStartY = wallGridY;
                        const doorwayEndY = wallGridY + doorwayWidth * gridSize;
                        
                        // 如果墙壁与门口有重叠，需要移除
                        if (wallWorldY < doorwayEndY && wallWorldY + wallHeight > doorwayStartY) {
                            wallsToRemove.push(wall);
                        }
                    }
                }
            });
            
            // 移除找到的墙壁
            wallsToRemove.forEach(wall => {
                wall.destroy();
            });
            
            // 记录门口信息（用于将来可能的扩展，如关闭门口等）
            this.evacuationDoorway = {
                roomX: evacRoom.x,
                roomY: evacRoom.y,
                side: 'left',
                pos: doorwayPos,
                width: doorwayWidth
            };
            // 使用evacuationDoorway避免编译警告
            if (this.evacuationDoorway) {
                // 门口信息已记录
            }
            
            // 在门口位置添加视觉标记（让玩家知道这里可以进入）
            const doorwayMarker = this.add.graphics();
            doorwayMarker.fillStyle(0x00ff00, 0.2);
            doorwayMarker.fillRect(0, 0, gridSize, doorwayWidth * gridSize);
            doorwayMarker.setPosition(wallGridX, wallGridY);
            doorwayMarker.setDepth(-49);
            doorwayMarker.setScrollFactor(1, 1);
            
            // 添加门口提示文字
            const doorwayText = this.add.text(
                wallGridX + gridSize / 2,
                wallGridY + doorwayWidth * gridSize / 2,
                '入口',
                {
                    fontSize: '16px',
                    color: '#00ff00',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: { left: 5, right: 5, top: 2, bottom: 2 }
                }
            );
            doorwayText.setOrigin(0.5);
            doorwayText.setDepth(60);
            doorwayText.setScrollFactor(1, 1);
            
            console.log(`撤离点房间门口已开启: 位置(${wallGridX}, ${wallGridY}), 宽度=${doorwayWidth * gridSize}`);
            
        } catch (error) {
            console.error('开启撤离点房间门口时出错:', error);
        }
    }
    
    // 添加房间细节元素
    private addRoomDetails(rooms: any[], gridSize: number) {
        rooms.forEach(room => {
            // 定义墙壁宽度和高度为网格大小
            const wallWidth = gridSize;
            const wallHeight = gridSize;
            
            const roomX = room.x * wallWidth;
            const roomY = room.y * wallHeight;
            const roomW = room.width * wallWidth;
            const roomH = room.height * wallHeight;
            
            // 为所有房间添加名称标识
            const roomName = this.add.text(roomX + 20, roomY + 20, room.name || room.type, {
                fontSize: '14px',
                color: '#cccccc',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: { left: 8, right: 8, top: 4, bottom: 4 }
            });
            roomName.setDepth(60);
            
            switch (room.type) {
                case 'start':
                    // 起始房间标记和补给箱
                    const startText = this.add.text(roomX + roomW/2, roomY + roomH/2, '起始区域', {
                        fontSize: '28px',
                        color: '#ffffff',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        padding: { left: 10, right: 10, top: 5, bottom: 5 },
                        // fontWeight: 'bold'
                    });
                    startText.setOrigin(0.5);
                    startText.setDepth(60);
                    
                    // 添加欢迎信息
                    const welcomeText = this.add.text(roomX + roomW/2, roomY + roomH/2 + 40, '准备开始行动', {
                        fontSize: '16px',
                        color: '#87CEEB'
                    });
                    welcomeText.setOrigin(0.5);
                    welcomeText.setDepth(60);
                    
                    // 添加一些战术标记
                    this.addTacticalMarker(roomX + 100, roomY + 100, 'A');
                    this.addTacticalMarker(roomX + roomW - 100, roomY + roomH - 100, 'B');
                    break;
                    
                case 'treasure':
                    // 宝藏房间的多层发光效果
                    const glowGraphic = this.add.graphics();
                    glowGraphic.fillStyle(0xffd700, 0.3);
                    glowGraphic.fillCircle(0, 0, roomW/3);
                    glowGraphic.setPosition(roomX + roomW/2, roomY + roomH/2);
                    glowGraphic.setDepth(-30);
                    
                    // 外层光晕
                    const outerGlow = this.add.graphics();
                    outerGlow.fillStyle(0xffa500, 0.2);
                    outerGlow.fillCircle(0, 0, roomW/2);
                    outerGlow.setPosition(roomX + roomW/2, roomY + roomH/2);
                    outerGlow.setDepth(-31);
                    
                    // 添加宝藏标记
                    const treasureText = this.add.text(roomX + roomW/2, roomY + 20, '宝藏室', {
                        fontSize: '24px',
                        color: '#ffd700',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { left: 10, right: 10, top: 5, bottom: 5 },
                        // fontWeight: 'bold'
                    });
                    treasureText.setOrigin(0.5, 0);
                    treasureText.setDepth(60);
                    
                    // 添加警告标志
                    const warningSign = this.add.text(roomX + roomW/2, roomY + roomH - 40, '⚠ 高价值区域 - 警戒', {
                        fontSize: '14px',
                        color: '#ff6666',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)'
                    });
                    warningSign.setOrigin(0.5);
                    warningSign.setDepth(60);
                    break;
                    
                case 'evac':
                    // 撤离点房间的特殊效果
                    const evacGlow = this.add.graphics();
                    evacGlow.fillStyle(0x00ff00, 0.2);
                    evacGlow.fillCircle(0, 0, roomW/2);
                    evacGlow.setPosition(roomX + roomW/2, roomY + roomH/2);
                    evacGlow.setDepth(-30);
                    
                    // 撤离点标记
                    const evacText = this.add.text(roomX + roomW/2, roomY + 20, '撤离点', {
                        fontSize: '28px',
                        color: '#00ff00',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { left: 10, right: 10, top: 5, bottom: 5 },
                        // fontWeight: 'bold'
                    });
                    evacText.setOrigin(0.5, 0);
                    evacText.setDepth(60);
                    
                    // 添加撤离说明
                    const evacInstruction = this.add.text(roomX + roomW/2, roomY + roomH - 40, '到达此处完成撤离', {
                        fontSize: '16px',
                        color: '#00ff00'
                    });
                    evacInstruction.setOrigin(0.5);
                    evacInstruction.setDepth(60);
                    break;
                    
                case 'main':
                    // 中央大厅标识
                    const mainHallText = this.add.text(roomX + roomW/2, roomY + 20, '中央大厅', {
                        fontSize: '24px',
                        color: '#ffffff',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { left: 10, right: 10, top: 5, bottom: 5 }
                    });
                    mainHallText.setOrigin(0.5, 0);
                    mainHallText.setDepth(60);
                    
                    // 添加战术地图标记
                    // 不再使用addTacticalMap方法
                    break;
                    
                case 'side':
                    // 侧室添加存储标识
                    const storageText = this.add.text(roomX + roomW/2, roomY + 20, room.name || '储藏室', {
                        fontSize: '20px',
                        color: '#cccccc',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        padding: { left: 10, right: 10, top: 4, bottom: 4 }
                    });
                    storageText.setOrigin(0.5, 0);
                    storageText.setDepth(60);
                    
                    // 添加一些杂物箱和储物架
                    for (let i = 0; i < 3; i++) {
                        const boxX = roomX + 50 + (i * 100);
                        const boxY = roomY + roomH - 60;
                        if (boxX < roomX + roomW - 50) {
                            this.addStorageBox(boxX, boxY);
                        }
                    }
                    break;
            }
        });
    }
    
    // 添加战术标记
    private addTacticalMarker(x: number, y: number, label: string) {
        const marker = this.add.graphics();
        
        // 标记背景
        marker.fillStyle(0x2c3e50, 0.8);
        marker.fillCircle(0, 0, 20);
        
        // 边框
        marker.lineStyle(2, 0x3498db, 1);
        marker.strokeCircle(0, 0, 20);
        
        marker.setPosition(x, y);
        marker.setDepth(55);
        
        // 添加标签文本
        const text = this.add.text(x, y, label, {
            fontSize: '18px',
            color: '#ffffff',
            // fontWeight: 'bold'
        });
        text.setOrigin(0.5);
        text.setDepth(56);
    }
    
    // 战术地图功能已移除
    
    // 创建固定位置的小地图
    private createMiniMap() {
        try {
            const camera = this.cameras.main;
            const { width } = camera;
            const mapWidth = 200;
            const mapHeight = 150;
            const mapX = width - mapWidth - 20;
            const mapY = (camera as any).height - mapHeight - 20;
            
            // 创建小地图背景
            const mapBg = this.add.graphics();
            mapBg.fillStyle(0x2c3e50, 0.9);
            mapBg.fillRect(mapX, mapY, mapWidth, mapHeight);
            mapBg.lineStyle(2, 0x3498db, 1);
            mapBg.strokeRect(mapX, mapY, mapWidth, mapHeight);
            mapBg.setDepth(55);
            mapBg.setScrollFactor(0);
            
            // 小地图标题
            const mapTitle = this.add.text(mapX + mapWidth/2, mapY + 15, '战术地图', {
                fontSize: '14px',
                color: '#ffffff',
                // fontWeight: 'bold'
            });
            mapTitle.setOrigin(0.5);
            mapTitle.setDepth(56);
            mapTitle.setScrollFactor(0);
            
            // 存储小地图位置信息供后续更新使用
            (this as any).miniMap = {
                x: mapX,
                y: mapY,
                width: mapWidth,
                height: mapHeight,
                background: mapBg,
                roomMarkers: [],
                playerMarker: null
            };
            
        } catch (error) {
            console.error('创建小地图时出错:', error);
        }
    }
    
    // 更新小地图内容
    private updateMiniMap() {
        if (!(this as any).miniMap || !this.playerBody) return;
        
        const { x: mapX, y: mapY, width: mapWidth, height: mapHeight } = (this as any).miniMap;
        // 定义地图总尺寸常量
        const worldWidth = 8000;
        const worldHeight = 6000;
        
        // 清除现有房间标记
        if ((this as any).miniMap.roomMarkers && Array.isArray((this as any).miniMap.roomMarkers)) {
            (this as any).miniMap.roomMarkers.forEach((marker: any) => marker.destroy());
            (this as any).miniMap.roomMarkers = [];
        } else {
            (this as any).miniMap.roomMarkers = [];
        }
        
        // 添加房间标记
        if ((this as any).rooms && Array.isArray((this as any).rooms)) {
            (this as any).rooms.forEach((room: any) => {
                // 使用gridSize计算正确的标记位置
                const gridSize = 80; // 与地图系统保持一致
                const roomMarkerX = mapX + 20 + ((room.x * gridSize) / worldWidth) * (mapWidth - 40);
                const roomMarkerY = mapY + 30 + ((room.y * gridSize) / worldHeight) * (mapHeight - 60);
                
                const roomMarker = this.add.graphics();
                let color: number;
                
                switch (room.type) {
                    case 'start': color = 0x4A6FA5; break;
                    case 'main': color = 0x5D4037; break;
                    case 'treasure': color = 0xFFD700; break;
                    case 'evac': color = 0x00FF00; break;
                    default: color = 0x3E4C59; break;
                }
                
                roomMarker.fillStyle(color, 0.8);
                // 根据房间大小调整标记大小
                const markerSize = Math.min(8, room.width * 2);
                roomMarker.fillRect(roomMarkerX - markerSize/2, roomMarkerY - markerSize/2, markerSize, markerSize);
                roomMarker.setDepth(56);
                roomMarker.setScrollFactor(0);
                
                (this as any).miniMap?.roomMarkers?.push(roomMarker);
            });
        }
        
        // 添加或更新玩家标记
        if ((this as any).miniMap?.playerMarker) {
            (this as any).miniMap.playerMarker.destroy();
        }
        
        // 使用已定义的worldWidth/worldHeight计算玩家标记位置
        const playerMarkerX = mapX + 20 + (this.playerBody.x / worldWidth) * (mapWidth - 40);
        const playerMarkerY = mapY + 30 + (this.playerBody.y / worldHeight) * (mapHeight - 60);
        
        const playerMarker = this.add.graphics();
        playerMarker.fillStyle(0xff0000, 1);
        playerMarker.fillCircle(playerMarkerX, playerMarkerY, 6);
        playerMarker.setDepth(57);
        playerMarker.setScrollFactor(0);
        
        (this as any).miniMap.playerMarker = playerMarker;
    }
    
    // 添加储物箱
    private addStorageBox(x: number, y: number) {
        const box = this.add.graphics();
        
        // 箱子主体
        box.fillStyle(0x555555, 1);
        box.fillRect(-15, -10, 30, 20);
        
        // 箱子边框
        box.lineStyle(1, 0x333333, 1);
        box.strokeRect(-15, -10, 30, 20);
        
        // 箱子细节
        box.fillStyle(0x444444, 1);
        box.fillRect(-13, -8, 26, 4);
        
        box.setPosition(x, y);
        box.setDepth(52);
        
        // 添加微弱的发光效果
        if (Math.random() > 0.7) {
            const glow = this.add.graphics();
            glow.fillStyle(0x666666, 0.3);
            glow.fillRect(-18, -13, 36, 26);
            glow.setPosition(x, y);
            glow.setDepth(51);
        }
    }
    
    // 创建背景网格和装饰 - 接受动态尺寸参数
    private createBackground(mapWidth: number, mapHeight: number, gridSize: number) {
        try {
            // 使用网格尺寸的一半作为背景网格线间距，确保视觉上的一致性
            const backgroundGridSize = gridSize / 2;
            
            // 创建地板（更暗的背景以便房间更突出）
            const floorGraphic = this.add.graphics();
            floorGraphic.fillStyle(0x050505, 1); // 几乎黑色，让房间更突出
            floorGraphic.fillRect(0, 0, mapWidth, mapHeight);
            floorGraphic.setDepth(-100);
            floorGraphic.setVisible(true);
            floorGraphic.setScrollFactor(1, 1); // 确保跟随相机
            
            // 创建层次感更强的网格
            const gridGraphic = this.add.graphics();
            
            // 主网格线 - 与房间网格对齐（更明显）
            gridGraphic.lineStyle(1, 0x222222, 0.5); // 更明显的网格线
            for (let x = 0; x <= mapWidth; x += gridSize) {
                gridGraphic.beginPath();
                gridGraphic.moveTo(x, 0);
                gridGraphic.lineTo(x, mapHeight);
                gridGraphic.stroke();
            }
            
            for (let y = 0; y <= mapHeight; y += gridSize) {
                gridGraphic.beginPath();
                gridGraphic.moveTo(0, y);
                gridGraphic.lineTo(mapWidth, y);
                gridGraphic.stroke();
            }
            
            // 次要网格线（更小的格子）
            gridGraphic.lineStyle(1, 0x151515, 0.3); // 稍微明显一点
            for (let x = 0; x <= mapWidth; x += backgroundGridSize) {
                gridGraphic.beginPath();
                gridGraphic.moveTo(x, 0);
                gridGraphic.lineTo(x, mapHeight);
                gridGraphic.stroke();
            }
            
            for (let y = 0; y <= mapHeight; y += backgroundGridSize) {
                gridGraphic.beginPath();
                gridGraphic.moveTo(0, y);
                gridGraphic.lineTo(mapWidth, y);
                gridGraphic.stroke();
            }
            
            gridGraphic.setDepth(-99);
            gridGraphic.setVisible(true);
            gridGraphic.setScrollFactor(1, 1); // 确保跟随相机
            
        } catch (error) {
            console.error('创建背景时出错:', error);
        }
    }
    
    // 添加环境效果
    private addEnvironmentalEffects() {
        try {
            // 添加一些微小的粒子效果，增加气氛
            // 如火星、火花等
            // 可以在后续实现
        } catch (error) {
            console.error('添加环境效果时出错:', error);
        }
    }

    // 创建玩家（使用图形代替精灵）
    private createPlayer() {
        try {
            // 设置玩家在起始房间的中心位置（网格坐标转换为像素坐标）
            // 起始房间：x: 10, y: 10, width: 10, height: 8, gridSize: 80
            // 房间中心 = (x + width/2) * gridSize, (y + height/2) * gridSize
            const gridSize = 80;
            const startRoomX = 10;
            const startRoomY = 10;
            const startRoomW = 10;
            const startRoomH = 8;
            this.playerX = (startRoomX + startRoomW / 2) * gridSize; // 1200
            this.playerY = (startRoomY + startRoomH / 2) * gridSize; // 1120
            
            // 创建玩家图形 - 现代化友好的英雄角色设计
            this.player = this.add.graphics();
            
            // 玩家外圈光环（友好标识）
            this.player.lineStyle(4, 0x00ff88, 0.8);
            this.player.strokeCircle(0, 0, 20);
            
            // 玩家主体 - 圆形身体（更亮更鲜艳）
            this.player.fillStyle(0x00ff88, 1);
            this.player.fillCircle(0, 0, 18);
            
            // 外边框（更粗更明显）
            this.player.lineStyle(4, 0x00cc66, 1);
            this.player.strokeCircle(0, 0, 18);
            
            // 身体高光（左上角）
            this.player.fillStyle(0x88ffaa, 1);
            this.player.fillCircle(-4, -4, 10);
            
            // 身体阴影（右下角）
            this.player.fillStyle(0x00cc66, 1);
            this.player.fillCircle(4, 4, 10);
            
            // 中心能量核心（多层设计）
            this.player.fillStyle(0xffffff, 1);
            this.player.fillCircle(0, 0, 7);
            this.player.fillStyle(0x00ff88, 1);
            this.player.fillCircle(0, 0, 5);
            this.player.fillStyle(0xaaffcc, 1);
            this.player.fillCircle(0, 0, 3);
            
            // 头部（更大更圆润）
            this.player.fillStyle(0x00ff88, 1);
            this.player.fillCircle(0, -10, 12);
            this.player.lineStyle(3, 0x00cc66, 1);
            this.player.strokeCircle(0, -10, 12);
            
            // 头部高光
            this.player.fillStyle(0x88ffaa, 0.9);
            this.player.fillCircle(-3, -12, 5);
            
            // 眼睛（更大更友好）
            this.player.fillStyle(0x000000, 1);
            this.player.fillCircle(-4, -12, 3);
            this.player.fillCircle(4, -12, 3);
            // 眼睛高光（两个亮点）
            this.player.fillStyle(0xffffff, 1);
            this.player.fillCircle(-3.5, -12.5, 1.5);
            this.player.fillCircle(4.5, -12.5, 1.5);
            this.player.fillCircle(-5, -12.5, 0.8);
            this.player.fillCircle(3, -12.5, 0.8);
            
            // 方向指示器 - 箭头（身体下方，更明显）
            this.player.fillStyle(0x00cc66, 1);
            this.player.beginPath();
            this.player.moveTo(0, 18);
            this.player.lineTo(-8, 10);
            this.player.lineTo(8, 10);
            this.player.closePath();
            this.player.fill();
            this.player.lineStyle(2, 0x00aa55, 1);
            this.player.strokePath();
            
            // 装饰条纹（身体中间，更明显）
            this.player.lineStyle(3, 0x00cc66, 0.8);
            this.player.beginPath();
            this.player.moveTo(-14, 0);
            this.player.lineTo(14, 0);
            this.player.strokePath();
            
            // 能量环（围绕身体的装饰环）
            this.player.lineStyle(2, 0x88ffaa, 0.6);
            this.player.strokeCircle(0, 0, 15);
            
            // 友好标识 - 顶部小星星
            this.player.fillStyle(0xffff00, 1);
            this.drawStar(this.player, 0, -22, 3, 2);
            this.player.fillPath();
            
            // 添加友好的发光效果（更亮更明显）
            const glowGraphic = this.add.graphics();
            glowGraphic.fillStyle(0x00ff88, 0.4);
            glowGraphic.fillCircle(0, 0, 25);
            glowGraphic.fillStyle(0x88ffaa, 0.2);
            glowGraphic.fillCircle(0, 0, 35);
            glowGraphic.setPosition(this.playerX, this.playerY);
            glowGraphic.setDepth(99);
            
            // 呼吸动画效果
            this.tweens.add({
                targets: glowGraphic,
                alpha: [0.3, 0.5, 0.3],
                duration: 2000,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            this.player.setPosition(this.playerX, this.playerY);
            this.player.setDepth(100);
            
            // 创建物理碰撞体并存储为成员变量
            this.playerBody = this.physics.add.sprite(this.playerX, this.playerY, '');
            this.playerBody.setCircle(15);
            this.playerBody.setCollideWorldBounds(true);
            this.playerBody.setDepth(100);
            this.playerBody.setVisible(false); // 隐藏物理碰撞体的方块显示
            
            // playerBody创建后重新设置相机跟随
            // 延迟一帧确保物理体完全初始化
            this.time.delayedCall(0, () => {
                this.setupCamera();
                // 确保相机立即在玩家位置
                if (this.cameras.main && this.playerBody) {
                    this.cameras.main.centerOn(this.playerBody.x, this.playerBody.y);
                }
            });
            
            // 添加移动粒子效果
            this.createPlayerParticles();
            
            // 存储发光图形引用以便后续更新
            (this as any).playerGlowGraphic = glowGraphic;
            
            // 添加与墙壁的碰撞
            this.physics.add.collider(this.playerBody, this.walls);
            
            console.log('玩家创建成功，位置:', this.playerX, this.playerY);
            
        } catch (error) {
            console.error('创建玩家时出错:', error);
        }
    }
    
    // 创建玩家移动粒子效果
    private createPlayerParticles() {
        try {
            // 使用精灵组来模拟简单的粒子效果，避免使用已移除的createEmitter
            (this as any).playerParticles = this.add.group();
            
            // 创建一个简单的粒子池
            for (let i = 0; i < 20; i++) {
                const particle = this.add.circle(0, 0, 3, 0x00ff00, 0.8);
                particle.visible = false;
                (this as any).playerParticles?.add(particle);
            }
            
            // 将粒子发射器跟随玩家
            let lastEmitTime = 0;
            this.playerBody.on('update', (time: number) => {
                if ((this.playerBody.body?.velocity?.x !== 0 || this.playerBody.body?.velocity?.y !== 0) && 
                    time - lastEmitTime > 100) {
                    lastEmitTime = time;
                    
                    // 发射两个粒子
                    for (let i = 0; i < 2; i++) {
                        const particle = (this as any).playerParticles?.getFirstDead(false);
                        if (particle) {
                            particle.x = this.playerBody.x;
                            particle.y = this.playerBody.y;
                            particle.visible = true;
                            
                            // 随机速度
                            const speed = 50 + Math.random() * 50;
                            const angle = Math.random() * Math.PI * 2;
                            
                            // 使用tween实现粒子动画
                            this.tweens.add({
                                targets: particle,
                                x: particle.x + Math.cos(angle) * speed,
                                y: particle.y + Math.sin(angle) * speed,
                                alpha: { start: 0.8, end: 0 },
                                scale: { start: 1, end: 0 },
                                duration: 300,
                                onComplete: () => {
                                    particle.visible = false;
                                }
                            });
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('创建玩家粒子效果时出错:', error);
        }
    }
    
    // 更新玩家移动
    private updatePlayerMovement(_delta: number) {
        try {
            if (!this.playerBody) return;
            
            // 根据总重量计算实际移动速度（重量越大，速度越慢）
            // 每10单位重量减少5%速度，最多减少50%
            const weightPenalty = Math.min(this.totalWeight / 10 * 0.05, 0.5);
            const currentSpeed = this.basePlayerSpeed * (1 - weightPenalty);
            this.playerSpeed = currentSpeed;
            
            let velocityX = 0;
            let velocityY = 0;
            
            // 检查按键输入
            if (this.keys?.left?.isDown || this.wasdKeys?.a?.isDown) {
                velocityX -= this.playerSpeed;
            }
            if (this.keys?.right?.isDown || this.wasdKeys?.d?.isDown) {
                velocityX += this.playerSpeed;
            }
            if (this.keys?.up?.isDown || this.wasdKeys?.w?.isDown) {
                velocityY -= this.playerSpeed;
            }
            if (this.keys?.down?.isDown || this.wasdKeys?.s?.isDown) {
                velocityY += this.playerSpeed;
            }
            
            // 标准化速度向量，确保斜向移动速度相同
            const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
            if (magnitude > 0) {
                velocityX = (velocityX / magnitude) * this.playerSpeed;
                velocityY = (velocityY / magnitude) * this.playerSpeed;
            }
            
            // 应用速度
            this.playerBody.setVelocity(velocityX, velocityY);
            
            // 玩家移动视觉反馈
            if (magnitude > 0) {
                // 移动时：稍微放大，增加速度感
                if (!this.playerMoving) {
                    this.playerMoving = true;
                    this.tweens.add({
                        targets: this.player,
                        scale: { from: 1.0, to: 1.05 },
                        duration: 100,
                        ease: 'Power2'
                    });
                }
            } else {
                // 静止时：恢复原大小
                if (this.playerMoving) {
                    this.playerMoving = false;
                    this.tweens.add({
                        targets: this.player,
                        scale: { from: 1.05, to: 1.0 },
                        duration: 100,
                        ease: 'Power2'
                    });
                }
            }
            
            // 相机跟随由setupCamera中的startFollow处理
            
        } catch (error) {
            console.error('更新玩家移动时出错:', error);
        }
    }
    
    // 设置键盘控制
    private setupKeyboard() {
        try {
            this.keys = this.input.keyboard?.createCursorKeys() || {} as Phaser.Types.Input.Keyboard.CursorKeys;
            
            // WASD控制
            if (this.input.keyboard) {
                this.wasdKeys = {
                    w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                    a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                    s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                    d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
                };
                
                // 添加E键用于交互
                if (!this.keys) this.keys = {} as Phaser.Types.Input.Keyboard.CursorKeys;
                (this.keys as any).e = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
                
                // 添加TAB键用于打开/关闭背包
                (this.keys as any).tab = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
                
                // 设置E键监听（用于撤离开关交互）
                this.input.keyboard.on('keydown-E', () => {
                    this.eKeyPressed = true;
                });
            }
            
        } catch (error) {
            console.error('设置键盘控制时出错:', error);
        }
    }
    
    // 创建HUD - 优化版状态栏
    private createHUD() {
        try {
            const camera = this.cameras.main;
            const { width } = camera;
            
            // 创建更精致的玩家状态面板（左上角）
            const statusPanelBg = this.add.graphics();
            // 外层发光边框
            statusPanelBg.fillStyle(0x3498db, 0.2);
            statusPanelBg.fillRoundedRect(12, 12, 286, 206, 12);
            // 主背景
            statusPanelBg.fillStyle(0x0a0a0a, 0.85);
            statusPanelBg.fillRoundedRect(15, 15, 280, 200, 10);
            // 内层高光
            statusPanelBg.lineStyle(2, 0x3498db, 0.6);
            statusPanelBg.strokeRoundedRect(15, 15, 280, 200, 10);
            // 顶部装饰条
            statusPanelBg.fillStyle(0x3498db, 0.3);
            statusPanelBg.fillRoundedRect(15, 15, 280, 35, 10);
            statusPanelBg.setScrollFactor(0);
            statusPanelBg.setDepth(1000);
            
            // 标题 - 更精致的样式
            const titleText = this.add.text(155, 28, '⚔ 玩家状态', {
                fontSize: '18px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            titleText.setOrigin(0.5, 0);
            titleText.setScrollFactor(0);
            titleText.setDepth(1001);
            
            // 时间显示 - 添加图标
            this.timerText = this.add.text(30, 58, '⏱ 时间: 0s', { 
                fontSize: '15px', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.timerText.setScrollFactor(0);
            this.timerText.setDepth(1001);
            
            // 金钱显示 - 添加图标和阴影
            this.moneyText = this.add.text(30, 83, '💰 金钱: $0', { 
                fontSize: '15px', 
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2,
                fontStyle: 'bold'
            });
            this.moneyText.setScrollFactor(0);
            this.moneyText.setDepth(1001);
            
            // 击杀数显示 - 添加图标
            (this as any).killsText = this.add.text(30, 108, '💀 击杀: 0', {
                fontSize: '15px',
                color: '#ff6b6b',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).killsText.setScrollFactor(0);
            (this as any).killsText.setDepth(1001);
            
            // 生命值标签和数值 - 改进样式
            this.add.text(30, 138, '❤ 生命值', { 
                fontSize: '14px', 
                color: '#ff6b6b',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setScrollFactor(0).setDepth(1001);
            
            (this as any).healthText = this.add.text(250, 138, '100/100', {
                fontSize: '14px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).healthText.setOrigin(1, 0);
            (this as any).healthText.setScrollFactor(0);
            (this as any).healthText.setDepth(1001);
            
            // 创建健康条背景 - 更精致的设计
            const healthBarBg = this.add.graphics();
            healthBarBg.fillStyle(0x000000, 0.6);
            healthBarBg.fillRoundedRect(28, 158, 239, 22, 11);
            healthBarBg.lineStyle(1, 0x666666, 0.5);
            healthBarBg.strokeRoundedRect(28, 158, 239, 22, 11);
            healthBarBg.setScrollFactor(0);
            healthBarBg.setDepth(1000);
            
            // 创建健康条 - 添加渐变效果
            this.playerHealthBar = this.add.graphics();
            this.playerHealthBar.setScrollFactor(0);
            this.playerHealthBar.setDepth(1001);
            
            // 护甲标签和数值
            this.add.text(30, 183, '🛡 护甲', { 
                fontSize: '14px', 
                color: '#3498db',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setScrollFactor(0).setDepth(1001);
            
            (this as any).armorText = this.add.text(250, 183, '0/100', {
                fontSize: '14px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).armorText.setOrigin(1, 0);
            (this as any).armorText.setScrollFactor(0);
            (this as any).armorText.setDepth(1001);
            
            // 创建护甲条背景
            const armorBarBg = this.add.graphics();
            armorBarBg.fillStyle(0x000000, 0.6);
            armorBarBg.fillRoundedRect(28, 198, 239, 17, 8);
            armorBarBg.lineStyle(1, 0x666666, 0.5);
            armorBarBg.strokeRoundedRect(28, 198, 239, 17, 8);
            armorBarBg.setScrollFactor(0);
            armorBarBg.setDepth(1000);
            
            // 创建护甲条
            this.playerArmorBar = this.add.graphics();
            this.playerArmorBar.setScrollFactor(0);
            this.playerArmorBar.setDepth(1001);
            
            // 创建中央提示区域（顶部中央）- 更精致
            const notificationBg = this.add.graphics();
            // 外层发光
            notificationBg.fillStyle(0x2ecc71, 0.15);
            notificationBg.fillRoundedRect(width/2 - 203, 7, 406, 51, 10);
            // 主背景
            notificationBg.fillStyle(0x0a0a0a, 0.8);
            notificationBg.fillRoundedRect(width/2 - 200, 10, 400, 45, 8);
            // 渐变顶部条
            notificationBg.fillStyle(0x2ecc71, 0.3);
            notificationBg.fillRoundedRect(width/2 - 200, 10, 400, 8, 8);
            // 边框
            notificationBg.lineStyle(2, 0x2ecc71, 0.6);
            notificationBg.strokeRoundedRect(width/2 - 200, 10, 400, 45, 8);
            notificationBg.setScrollFactor(0);
            notificationBg.setDepth(1000);
            
            // 创建撤离提示文本
            this.evacuationText = this.add.text(
                width / 2, 
                32, 
                '', 
                {
                    fontSize: '18px',
                    color: '#00ff00',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            );
            this.evacuationText.setScrollFactor(0);
            this.evacuationText.setOrigin(0.5, 0.5);
            this.evacuationText.setDepth(1001);
            
        } catch (error) {
            console.error('创建HUD时出错:', error);
        }
    }
    
    // 初始化武器系统
    private initWeapons() {
        try {
            // 清空现有武器
            this.weapons = [];
            
            // 添加多种武器类型，包含完整的武器属性
            this.weapons.push(
                new Weapon({
                    name: '手枪',
                    damage: 15,
                    fireRate: 500,
                    range: 800,
                    bulletSpeed: 600,
                    ammoCapacity: 12,
                    bulletSize: 4,
                    color: 0xaaaaaa,
                    ammoType: 'pistol',
                    precision: 0.85, // 85%精度
                    recoil: 0.03 // 较小后坐力
                }),
                new Weapon({
                    name: '步枪',
                    damage: 25,
                    fireRate: 300,
                    range: 1200,
                    bulletSpeed: 800,
                    ammoCapacity: 30,
                    bulletSize: 5,
                    color: 0x00ff00,
                    ammoType: 'rifle',
                    precision: 0.75, // 75%精度（连射精度较低）
                    recoil: 0.08 // 中等后坐力
                }),
                new Weapon({
                    name: '霰弹枪',
                    damage: 35,
                    fireRate: 700,
                    range: 600,
                    bulletSpeed: 500,
                    ammoCapacity: 8,
                    bulletSize: 6,
                    color: 0xff7700,
                    ammoType: 'shotgun',
                    precision: 0.6, // 60%精度（近距离武器）
                    recoil: 0.12, // 较大后坐力
                    spread: 15 // 15度扩散
                }),
                new Weapon({
                    name: '狙击枪',
                    damage: 70,
                    fireRate: 1000,
                    range: 2000,
                    bulletSpeed: 1200,
                    ammoCapacity: 5,
                    bulletSize: 8,
                    color: 0x0000ff,
                    ammoType: 'rifle',
                    precision: 0.98, // 98%精度（高精度）
                    recoil: 0.15 // 大后坐力但恢复快
                })
            );
            
            (this as any).currentWeaponIndex = 0;
            
            // 给初始武器添加弹药
            this.weapons[0].reserveAmmo = 120; // 手枪备用弹药
            
            // 创建武器信息面板（左下角）- 更精致的设计
            const weaponPanelBg = this.add.graphics();
            // 外层发光
            weaponPanelBg.fillStyle(0xe74c3c, 0.2);
            weaponPanelBg.fillRoundedRect(12, this.cameras.main.height - 123, 286, 111, 12);
            // 主背景
            weaponPanelBg.fillStyle(0x0a0a0a, 0.85);
            weaponPanelBg.fillRoundedRect(15, this.cameras.main.height - 120, 280, 105, 10);
            // 顶部装饰条
            weaponPanelBg.fillStyle(0xe74c3c, 0.3);
            weaponPanelBg.fillRoundedRect(15, this.cameras.main.height - 120, 280, 30, 10);
            // 边框
            weaponPanelBg.lineStyle(2, 0xe74c3c, 0.6);
            weaponPanelBg.strokeRoundedRect(15, this.cameras.main.height - 120, 280, 105, 10);
            weaponPanelBg.setScrollFactor(0);
            weaponPanelBg.setDepth(1000);
            
            // 武器名称 - 添加图标和样式
            this.weaponText = this.add.text(30, this.cameras.main.height - 105, '🔫 武器: 手枪', { 
                fontSize: '18px', 
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            this.weaponText.setScrollFactor(0);
            this.weaponText.setDepth(1001);
            
            // 弹药信息 - 改进样式
            (this as any).ammoText = this.add.text(30, this.cameras.main.height - 75, '📦 弹夹: 12 | 备弹: 120', { 
                fontSize: '15px', 
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).ammoText.setScrollFactor(0);
            (this as any).ammoText.setDepth(1001);
            
            // 操作提示 - 更醒目的样式
            const controlText = this.add.text(30, this.cameras.main.height - 45, '🎮 [ 鼠标左键 ] 射击  [ R ] 换弹  [ 1-4 ] 切换  [ TAB ] 背包', {
                fontSize: '12px',
                color: '#95a5a6',
                stroke: '#000000',
                strokeThickness: 2
            });
            controlText.setScrollFactor(0);
            controlText.setDepth(1001);
            
            // 添加武器切换功能
            this.input.keyboard?.on('keydown-1', () => this.switchWeapon(0));
            this.input.keyboard?.on('keydown-2', () => this.switchWeapon(1));
            this.input.keyboard?.on('keydown-3', () => this.switchWeapon(2));
            this.input.keyboard?.on('keydown-4', () => this.switchWeapon(3));
            
            // 添加换弹功能
            this.input.keyboard?.on('keydown-R', () => this.reload());
            
            // 更新显示
            this.updateWeaponDisplay();
            
        } catch (error) {
            console.error('初始化武器系统时出错:', error);
        }
    }
    
    // 切换武器
    private switchWeapon(index: number) {
        try {
            if (index >= 0 && index < this.weapons.length) {
                const weapon = this.weapons[index];
                // 手枪始终可用，其他武器需要有弹药
                if (index === 0 || (weapon.currentAmmo > 0 || weapon.reserveAmmo > 0)) {
                    (this as any).currentWeaponIndex = index;
                    this.updateWeaponDisplay();
                    
                    // 切换武器特效
                    const weaponEffect = this.add.graphics();
                    weaponEffect.fillStyle(weapon.color, 0.2);
                    weaponEffect.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
                    weaponEffect.setScrollFactor(0);
                    
                    this.tweens.add({
                        targets: weaponEffect,
                        alpha: { from: 0.2, to: 0 },
                        duration: 200,
                        onComplete: () => weaponEffect.destroy()
                    });
                }
            }
        } catch (error) {
            console.error('切换武器时出错:', error);
        }
    }
    
    // 换弹
    private reload() {
        try {
            const weaponIndex = (this as any).currentWeaponIndex || 0;
            const weapon = this.weapons[weaponIndex];
            
            if (!weapon) return;
            
            // 检查是否需要换弹
            if (weapon.isReloading) {
                console.log('正在换弹中...');
                this.showNotification('正在换弹中...', '#ffaa00');
                return;
            }
            
            if (weapon.currentAmmo >= weapon.ammoCapacity) {
                console.log('弹夹已满，无需换弹');
                this.showNotification('弹夹已满', '#00ff00');
                return;
            }
            
            if (weapon.reserveAmmo <= 0) {
                console.log('没有备用弹药');
                this.showNotification('没有备用弹药！', '#ff0000');
                return;
            }
            
            // 开始换弹
            weapon.isReloading = true;
            
            // 显示换弹提示
            const reloadText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2 - 50,
                '换弹中...',
                {
                    fontSize: '28px',
                    color: '#ffff00',
                    fontStyle: 'bold',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: { x: 20, y: 10 }
                }
            );
            reloadText.setOrigin(0.5);
            reloadText.setScrollFactor(0);
            reloadText.setDepth(1500);
            
            // 创建换弹圆环进度指示器
            const reloadRing = this.add.graphics();
            reloadRing.setDepth(1499);
            
            // 圆环参数
            const ringRadius = 60;
            let currentAngle = 0;
            
            // 创建圆环动画
            const ringTween = this.tweens.addCounter({
                from: 0,
                to: 360,
                duration: 2500, // 改为2.5秒
                onUpdate: (tween) => {
                    if (!this.playerBody) return;
                    
                    const tweenValue = tween.getValue();
                    currentAngle = tweenValue !== null ? tweenValue : 0;
                    reloadRing.clear();
                    
                    // 将世界坐标转换为屏幕坐标
                    const screenX = this.playerBody.x - this.cameras.main.scrollX;
                    const screenY = this.playerBody.y - this.cameras.main.scrollY;
                    
                    // 绘制圆环背景（灰色）
                    reloadRing.lineStyle(6, 0x444444, 0.3);
                    reloadRing.beginPath();
                    reloadRing.arc(screenX, screenY, ringRadius, 0, Phaser.Math.DegToRad(360), false);
                    reloadRing.strokePath();
                    
                    // 绘制进度圆环（黄色，逐渐减少）
                    const remainingAngle = 360 - currentAngle;
                    if (remainingAngle > 0) {
                        reloadRing.lineStyle(6, 0xffff00, 0.8);
                        reloadRing.beginPath();
                        reloadRing.arc(
                            screenX, 
                            screenY, 
                            ringRadius, 
                            Phaser.Math.DegToRad(-90), 
                            Phaser.Math.DegToRad(-90 + remainingAngle), 
                            false
                        );
                        reloadRing.strokePath();
                    }
                    
                    // 在圆环中心显示百分比
                    const percent = Math.floor((1 - currentAngle / 360) * 100);
                    reloadRing.fillStyle(0xffffff, 1);
                },
                onComplete: () => {
                    reloadRing.destroy();
                }
            });
            
            reloadRing.setScrollFactor(0);
            
            // 播放换弹音效
            this.playReloadSound();
            
            // 2.5秒后完成换弹
            this.time.delayedCall(2500, () => {
                if (!weapon) return;
                
                // 计算需要的弹药量
                const ammoNeeded = weapon.ammoCapacity - weapon.currentAmmo;
                const ammoToLoad = Math.min(ammoNeeded, weapon.reserveAmmo);
                
                // 更新弹药
                weapon.currentAmmo += ammoToLoad;
                weapon.reserveAmmo -= ammoToLoad;
                weapon.isReloading = false;
                
                // 更新显示
                this.updateWeaponDisplay();
                
                // 显示完成提示
                const completeText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2 - 50,
                    '换弹完成！',
                    {
                        fontSize: '24px',
                        color: '#00ff00',
                        fontStyle: 'bold'
                    }
                );
                completeText.setOrigin(0.5);
                completeText.setScrollFactor(0);
                completeText.setDepth(1500);
                
                this.tweens.add({
                    targets: completeText,
                    alpha: { from: 1, to: 0 },
                    duration: 500,
                    onComplete: () => completeText.destroy()
                });
                
                console.log(`换弹完成：装填 ${ammoToLoad} 发弹药`);
            });
            
            // 换弹提示渐隐
            this.tweens.add({
                targets: reloadText,
                alpha: { from: 1, to: 0 },
                duration: 2500,
                onComplete: () => {
                    reloadText.destroy();
                }
            });
            
        } catch (error) {
            console.error('换弹时出错:', error);
        }
    }
    
    // 更新HUD显示
    private updateHUD() {
        try {
            // 更新生命值
            if ((this as any).healthText) {
                (this as any).healthText.setText(`${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`);
            }
            
            if (this.playerHealthBar) {
                this.playerHealthBar.clear();
                const healthPercent = this.playerHealth / this.playerMaxHealth;
                const barWidth = 235 * healthPercent;
                
                // 根据生命值百分比改变颜色
                let healthColor = 0x2ecc71; // 绿色
                if (healthPercent < 0.3) {
                    healthColor = 0xe74c3c; // 红色
                } else if (healthPercent < 0.6) {
                    healthColor = 0xf39c12; // 橙色
                }
                
                // 绘制健康条 - 添加圆角和内发光效果
                this.playerHealthBar.fillStyle(healthColor, 1);
                this.playerHealthBar.fillRoundedRect(30, 160, barWidth, 18, 9);
                
                // 添加高光效果
                this.playerHealthBar.fillStyle(0xffffff, 0.3);
                this.playerHealthBar.fillRoundedRect(30, 160, barWidth, 6, 3);
            }
            
            // 更新护甲
            if ((this as any).armorText) {
                (this as any).armorText.setText(`${Math.ceil(this.playerArmor)}/100`);
            }
            
            if (this.playerArmorBar) {
                this.playerArmorBar.clear();
                const armorPercent = this.playerArmor / 100;
                const armorWidth = 235 * armorPercent;
                
                // 绘制护甲条 - 添加圆角和光泽效果
                this.playerArmorBar.fillStyle(0x3498db, 1);
                this.playerArmorBar.fillRoundedRect(30, 200, armorWidth, 13, 6);
                
                // 添加高光效果
                this.playerArmorBar.fillStyle(0xffffff, 0.3);
                this.playerArmorBar.fillRoundedRect(30, 200, armorWidth, 4, 2);
            }
            
            // 更新击杀数
            if ((this as any).killsText) {
                (this as any).killsText.setText(`击杀: ${this.enemiesKilled}`);
            }
            
            // 更新金钱
            if (this.moneyText) {
                this.moneyText.setText(`金钱: $${this.playerMoney}`);
            }
            
        } catch (error) {
            console.error('更新HUD时出错:', error);
        }
    }
    
    // 更新武器显示
    private updateWeaponDisplay() {
        try {
            const weaponIndex = (this as any).currentWeaponIndex || 0;
            const weapon = this.weapons[weaponIndex];
            if (weapon && this.weaponText && (this as any).ammoText) {
                this.weaponText.setText(`武器: ${weapon.name}`);
                
                // 手枪不消耗弹药
                if ((weapon as any).isUnlimited) {
                    (this as any).ammoText.setText('弹夹: ∞ | 备弹: ∞');
                } else {
                    (this as any).ammoText.setText(`弹夹: ${weapon.currentAmmo} | 备弹: ${weapon.reserveAmmo}`);
                }
            }
        } catch (error) {
            console.error('更新武器显示时出错:', error);
        }
    }
    
    // 添加弹药
    private addAmmo(weaponIndex: number, amount: number) {
        try {
            if (weaponIndex >= 0 && weaponIndex < this.weapons.length) {
                const weapon = this.weapons[weaponIndex];
                if (weapon && !(weapon as any).isUnlimited) {
                    weapon.reserveAmmo = Math.min(weapon.reserveAmmo + amount, weapon.maxReserveAmmo);
                    this.updateWeaponDisplay();
                }
            }
        } catch (error) {
            console.error('添加弹药时出错:', error);
        }
    }
    
    // 设置相机 - 优化的相机跟随系统
    private setupCamera() {
        try {
            const camera = this.cameras.main;
            if (camera && this.playerBody) {
                // 调整缩放比例以更好地适应扩大的地图
                camera.setZoom(0.8); // 放大以便看清细节
                
                // 设置世界边界
                camera.setBounds(0, 0, 8000, 6000); 
                
                // 优化相机跟随，使用更平滑的插值
                // lerp值越小，跟随越平滑（0.08-0.12是较好的平衡）
                camera.startFollow(this.playerBody, true, 0.08, 0.08);
                
                // 设置相机跟随的偏移（让玩家在屏幕中心偏上一点）
                camera.setFollowOffset(0, -50);
                
                // 设置死亡区域（玩家在区域内移动时相机不移动）
                camera.setDeadzone(200, 150);
                
                // 启用相机边界平滑（当接近边界时）
                camera.setRoundPixels(false);
                
                console.log('相机跟随已设置，玩家位置:', this.playerBody.x, this.playerBody.y);
            } else if (camera) {
                // 如果玩家还没有创建，先设置相机边界和背景
                camera.setBounds(0, 0, 8000, 6000);
                camera.setBackgroundColor(0x000000);
                console.log('相机边界已设置，等待玩家创建');
            }
        } catch (error) {
            console.error('设置相机时出错:', error);
        }
    }
    
    // 创建相机摇晃效果
    private createCameraShake(intensity: number = 5, duration: number = 200) {
        try {
            if (!this.cameras.main) return;
            
            // 使用Phaser内置的相机摇晃方法
            this.cameras.main.shake(duration, intensity * 0.001, false, function() {
                // 摇晃完成后的回调
                // 相机自动恢复，无需额外操作
            });
        } catch (error) {
            console.error('创建相机摇晃效果时出错:', error);
        }
    }
    
    // 设置鼠标控制
    private setupMouse() {
        try {
            // 创建十字准星
            this.crosshairGraphic = this.add.graphics();
            this.crosshairGraphic.lineStyle(2, 0xff0000, 1);
            this.crosshairGraphic.beginPath();
            this.crosshairGraphic.moveTo(0, -8);
            this.crosshairGraphic.lineTo(0, 8);
            this.crosshairGraphic.moveTo(-8, 0);
            this.crosshairGraphic.lineTo(8, 0);
            this.crosshairGraphic.strokePath();
            this.crosshairGraphic.setScrollFactor(0);
            this.crosshairGraphic.setDepth(1000);
            
            // 隐藏默认鼠标指针
            this.input.setDefaultCursor('none');
            
            // 更新鼠标位置
            this.input.on('pointermove', (pointer: any) => {
                this.crosshairGraphic.setPosition(pointer.x, pointer.y);
            });
            
            // 添加射击功能（支持按住连续射击）
            this.input.on('pointerdown', (pointer: any) => {
                if (!this.gameStarted || !this.playerBody) return;
                
                // 使用世界坐标立即射击一次
                this.shoot(pointer.worldX, pointer.worldY);
                
                // 设置连续射击标志
                (this as any).isShooting = true;
            });
            
            this.input.on('pointerup', () => {
                (this as any).isShooting = false;
            });
            
            // 在update中处理连续射击
            (this as any).lastShootTime = 0;
            
        } catch (error) {
            console.error('设置鼠标控制时出错:', error);
        }
    }
    
    // 射击方法
    private shoot(targetX: number, targetY: number) {
        try {
            if (!this.playerBody || !this.gameStarted) return;
            
            // 获取当前武器
            const weaponIndex = (this as any).currentWeaponIndex || 0;
            const weapon = this.weapons[weaponIndex];
            if (!weapon) return;
            
            // 优化：放宽冷却时间检查
            const now = this.time.now;
            if (now - weapon.lastFired < weapon.fireRate - 10) { // 减十10ms容差
                return;
            }
            
            // 检查弹药类型和数量
            if (!(weapon as any).isUnlimited) {
                // 检查弹夹内是否有弹药
                if (weapon.currentAmmo <= 0) {
                    // 尝试换弹
                    if (weapon.reserveAmmo > 0 && !weapon.isReloading) {
                        weapon.reload();
                    }
                    return;
                }
            }
            
            // 更新最后射击时间（提前设置避免被吠子弹）
            weapon.lastFired = now;
            
            // 消耗弹药
            if (!(weapon as any).isUnlimited) {
                weapon.currentAmmo--;
                this.updateWeaponDisplay?.();
            }
            
            // 使用世界坐标计算角度（targetX和targetY已经是世界坐标）
            const fromX = this.playerBody.x;
            const fromY = this.playerBody.y;
            let angle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY);
            
            // 应用精度和后坐力偏移
            const angleOffset = weapon.getShootAngleOffset();
            angle += angleOffset;
            
            // 根据武器类型处理射击
            if (weapon.spread) {
                // 霰弹枪扩散效果
                const spreadCount = 7; // 霰弹数量
                for (let i = 0; i < spreadCount; i++) {
                    // 计算每个霰弹的角度偏移
                    const spreadAngle = angle + (i - Math.floor(spreadCount / 2)) * (weapon.spread * Math.PI / 180) / Math.floor(spreadCount / 2);
                    this.createBullet(this.playerBody.x, this.playerBody.y, spreadAngle, weapon, i === Math.floor(spreadCount / 2));
                }
            } else {
                // 普通单发射击
                this.createBullet(this.playerBody.x, this.playerBody.y, angle, weapon, true);
            }
            
        } catch (error) {
            console.error('射击时出错:', error);
        }
    }
    
    // 创建子弹（射线检测）
    private createBullet(fromX: number, fromY: number, angle: number, weapon: any, isMain: boolean) {
        try {
            // 计算子弹终点（根据武器射程）
            let bulletEndX = fromX + Math.cos(angle) * weapon.range;
            let bulletEndY = fromY + Math.sin(angle) * weapon.range;
            
            // 射线检测：检查是否被墙壁阻挡
            const hitPoint = this.raycastHitWall(fromX, fromY, bulletEndX, bulletEndY);
            if (hitPoint) {
                bulletEndX = hitPoint.x;
                bulletEndY = hitPoint.y;
                // 创建墙壁击中特效
                this.createWallHitEffect(bulletEndX, bulletEndY, angle);
            }
            
            // 创建枪口闪光效果 - 增强的视觉反馈
            this.createMuzzleFlash(fromX, fromY, angle, weapon.color);
            
            // 创建子弹轨迹线
            const bulletGraphic = this.add.graphics();
            bulletGraphic.lineStyle(weapon.bulletSize, weapon.color || weapon.bulletColor, isMain ? 1 : 0.7);
            bulletGraphic.beginPath();
            bulletGraphic.moveTo(fromX, fromY);
            bulletGraphic.lineTo(bulletEndX, bulletEndY);
            bulletGraphic.strokePath();
            bulletGraphic.setDepth(60);
            
            // 子弹效果动画
            const travelDistance = Math.sqrt(Math.pow(bulletEndX - fromX, 2) + Math.pow(bulletEndY - fromY, 2));
            this.tweens.add({
                targets: bulletGraphic,
                alpha: { from: isMain ? 1 : 0.7, to: 0 },
                duration: travelDistance / weapon.bulletSpeed * 1000, // 根据实际距离计算持续时间
                onComplete: () => bulletGraphic.destroy()
            });
            
            // 检查击中目标（只检查到墙壁之间的目标）
            this.checkBulletHit(fromX, fromY, angle, weapon, hitPoint ? travelDistance : weapon.range);
            
            // 添加射击声音反馈
            this.showShootFeedback();
            
        } catch (error) {
            console.error('创建子弹时出错:', error);
        }
    }
    
    // 创建墙壁击中特效
    private createWallHitEffect(x: number, y: number, angle: number) {
        try {
            // 火花效果
            const sparks = this.add.graphics();
            sparks.fillStyle(0xffaa00, 1);
            
            // 创建多个火花粒子
            for (let i = 0; i < 8; i++) {
                const sparkAngle = angle + Math.PI + (Math.random() - 0.5) * Math.PI;
                const sparkDist = Math.random() * 15 + 5;
                const sparkX = Math.cos(sparkAngle) * sparkDist;
                const sparkY = Math.sin(sparkAngle) * sparkDist;
                sparks.fillCircle(sparkX, sparkY, 2);
            }
            
            sparks.setPosition(x, y);
            sparks.setDepth(62);
            
            // 火花动画
            this.tweens.add({
                targets: sparks,
                alpha: { from: 1, to: 0 },
                duration: 200,
                ease: 'Power2.easeOut',
                onComplete: () => sparks.destroy()
            });
            
            // 冲击波效果
            const impact = this.add.graphics();
            impact.fillStyle(0xffffff, 0.8);
            impact.fillCircle(0, 0, 5);
            impact.setPosition(x, y);
            impact.setDepth(62);
            
            this.tweens.add({
                targets: impact,
                scale: { from: 1, to: 2.5 },
                alpha: { from: 0.8, to: 0 },
                duration: 150,
                ease: 'Power2.easeOut',
                onComplete: () => impact.destroy()
            });
            
        } catch (error) {
            console.error('创建墙壁击中特效时出错:', error);
        }
    }
    
    // 创建枪口闪光效果
    private createMuzzleFlash(x: number, y: number, angle: number, color: number) {
        try {
            const flashSize = 15;
            const flashDistance = 20;
            
            // 枪口位置
            const flashX = x + Math.cos(angle) * flashDistance;
            const flashY = y + Math.sin(angle) * flashDistance;
            
            // 创建闪光效果
            const flash = this.add.graphics();
            
            // 主闪光 - 黄白色
            flash.fillStyle(0xffff00, 0.9);
            flash.fillCircle(0, 0, flashSize);
            
            // 外层闪光 - 橙色
            flash.fillStyle(color, 0.6);
            flash.fillCircle(0, 0, flashSize * 0.7);
            
            // 核心闪光 - 白色
            flash.fillStyle(0xffffff, 1);
            flash.fillCircle(0, 0, flashSize * 0.3);
            
            // 添加辐射效果
            flash.lineStyle(2, 0xffff00, 0.7);
            for (let i = 0; i < 6; i++) {
                const rayAngle = angle + (i - 2.5) * Math.PI / 6;
                const rayX = Math.cos(rayAngle) * flashSize;
                const rayY = Math.sin(rayAngle) * flashSize;
                flash.beginPath();
                flash.moveTo(0, 0);
                flash.lineTo(rayX, rayY);
                flash.stroke();
            }
            
            flash.setPosition(flashX, flashY);
            flash.setDepth(61);
            
            // 添加烟雾效果
            const smoke = this.add.graphics();
            smoke.fillStyle(0x888888, 0.3);
            smoke.fillCircle(0, 0, flashSize * 0.5);
            smoke.setPosition(flashX, flashY);
            smoke.setDepth(60);
            
            // 烟雾向前飘散
            this.tweens.add({
                targets: smoke,
                x: flashX + Math.cos(angle) * 30,
                y: flashY + Math.sin(angle) * 30,
                scale: { from: 1, to: 2.5 },
                alpha: { from: 0.3, to: 0 },
                duration: 400,
                ease: 'Power2.easeOut',
                onComplete: () => smoke.destroy()
            });
            
            // 闪光消退动画
            this.tweens.add({
                targets: flash,
                scale: { from: 1, to: 2 },
                alpha: { from: 1, to: 0 },
                duration: 80,
                ease: 'Power2.easeOut',
                onComplete: () => flash.destroy()
            });
            
        } catch (error) {
            console.error('创建枪口闪光时出错:', error);
        }
    }
    
    // 播放射击音效（使用Web Audio API生成程序化音效）
    private playShootSound(weapon: Weapon) {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // 根据武器类型创建不同音效
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 根据武器类型设置音效参数
            if (weapon.ammoType === 'shotgun') {
                // 霰弹枪 - 低沉的爆炸声
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            } else if (weapon.ammoType === 'sniper') {
                // 狙击枪 - 尖锐的爆炸声
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.08);
                gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);
            } else if (weapon.ammoType === 'rifle') {
                // 步枪 - 中频爆炸声
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.06);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            } else {
                // 手枪 - 高频短促声
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(180, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.05);
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            }
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            
            // 清理
            oscillator.onended = () => {
                oscillator.disconnect();
                gainNode.disconnect();
            };
            
        } catch (error) {
            console.error('播放射击音效时出错:', error);
        }
    }
    
    // 播放换弹音效
    private playReloadSound() {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // 创建换弹音效 - 机械声
            const oscillator1 = audioContext.createOscillator();
            const oscillator2 = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 第一段 - 弹夹退出
            oscillator1.type = 'square';
            oscillator1.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator1.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.15);
            
            // 第二段 - 弹夹插入
            oscillator2.type = 'triangle';
            oscillator2.frequency.setValueAtTime(150, audioContext.currentTime + 0.3);
            oscillator2.frequency.linearRampToValueAtTime(180, audioContext.currentTime + 0.45);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.12, audioContext.currentTime + 0.3);
            gainNode.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator1.start(audioContext.currentTime);
            oscillator1.stop(audioContext.currentTime + 0.2);
            oscillator2.start(audioContext.currentTime + 0.25);
            oscillator2.stop(audioContext.currentTime + 0.55);
            
            oscillator1.onended = () => {
                oscillator1.disconnect();
            };
            oscillator2.onended = () => {
                oscillator2.disconnect();
                gainNode.disconnect();
            };
            
        } catch (error) {
            console.error('播放换弹音效时出错:', error);
        }
    }
    
    // 显示射击反馈
    private showShootFeedback() {
        try {
            const weaponIndex = (this as any).currentWeaponIndex || 0;
            const weapon = this.weapons[weaponIndex];
            
            // 更新弹药显示
            this.updateWeaponDisplay();
            
            // 播放射击音效
            this.playShootSound(weapon);
            
            // 视觉反馈 - 屏幕闪烁（轻微）
            const feedbackFlash = this.add.graphics();
            feedbackFlash.fillStyle(0xffffff, 0.08);
            feedbackFlash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
            feedbackFlash.setScrollFactor(0);
            feedbackFlash.setDepth(100);
            
            this.tweens.add({
                targets: feedbackFlash,
                alpha: { from: 0.08, to: 0 },
                duration: 50,
                onComplete: () => feedbackFlash.destroy()
            });
            
        } catch (error) {
            console.error('显示射击反馈时出错:', error);
        }
    }
    
    // 射线检测：检查子弹是否击中墙壁
    private raycastHitWall(fromX: number, fromY: number, toX: number, toY: number): {x: number, y: number} | null {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(distance / 5); // 每5像素检测一次，提高精度
        
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        // 遍历射线路径，检查是否与墙壁碰撞
        for (let i = 1; i <= steps; i++) {
            const checkX = fromX + stepX * i;
            const checkY = fromY + stepY * i;
            
            // 检查这个点是否在墙壁内
            const walls = this.walls.getChildren();
            for (const wall of walls) {
                if (!wall || !wall.body) continue;
                
                const wallBody = wall.body as Phaser.Physics.Arcade.StaticBody;
                // 正确的碰撞检测：使用 body 的左上角坐标和尺寸
                if (checkX >= wallBody.x &&
                    checkX <= wallBody.x + wallBody.width &&
                    checkY >= wallBody.y &&
                    checkY <= wallBody.y + wallBody.height) {
                    // 击中墙壁，返回击中点
                    return { x: checkX, y: checkY };
                }
            }
        }
        
        return null; // 没有击中墙壁
    }
    
    // 检查子弹击中（考虑墙壁阻挡）
    private checkBulletHit(fromX: number, fromY: number, angle: number, weapon: any, maxRange: number) {
        try {
            // 根据武器精度调整误差范围 - 扩大命中范围
            const angleError = weapon.precision ? (1 - weapon.precision) * 0.5 : 0.3; // 增加命中范围
            
            // 检查是否击中可破坏物体
            if (this.destructibleObjects) {
                this.destructibleObjects.getChildren().forEach((destructible: any) => {
                    if (!destructible || !destructible.body) return;
                    
                    // 计算距离
                    const dx = destructible.x - fromX;
                    const dy = destructible.y - fromY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // 检查是否在有效射程内
                    if (distance <= maxRange) {
                        // 检查是否被墙壁阻挡
                        const hitWall = this.raycastHitWall(fromX, fromY, destructible.x, destructible.y);
                        if (hitWall) {
                            const wallDist = Math.sqrt(Math.pow(hitWall.x - fromX, 2) + Math.pow(hitWall.y - fromY, 2));
                            if (wallDist < distance) return; // 被墙壁阻挡
                        }
                        
                        // 检查角度是否在误差范围内
                        const targetAngle = Math.atan2(dy, dx);
                        const angleDiff = Math.abs(Phaser.Math.Angle.ShortestBetween(targetAngle, angle));
                        
                        if (angleDiff <= angleError) {
                            // 击中可破坏物体
                            this.handleDestructibleHit(destructible, weapon);
                        }
                    }
                });
            }
            
            // 找出所有在射程和角度范围内的敌人，但只选择最近的敌人（避免多个敌人同时受伤）
            const potentialEnemies = this.enemies.filter(enemy => {
                if (!enemy || !enemy.body || enemy.health <= 0) return false;
                
                // 使用物理体的实际位置，而不是缓存的x/y
                const enemyX = enemy.body.x;
                const enemyY = enemy.body.y;
                
                // 计算距离
                const enemyDist = Phaser.Math.Distance.Between(fromX, fromY, enemyX, enemyY);
                
                // 检查是否在有效射程内
                if (enemyDist > maxRange) return false;
                
                // 检查是否被墙壁阻挡
                const hitWall = this.raycastHitWall(fromX, fromY, enemyX, enemyY);
                if (hitWall) {
                    const wallDist = Math.sqrt(Math.pow(hitWall.x - fromX, 2) + Math.pow(hitWall.y - fromY, 2));
                    if (wallDist < enemyDist) return false; // 被墙壁阻挡
                }
                
                // 计算角度差 - 放宽命中判定
                const enemyAngle = Phaser.Math.Angle.Between(fromX, fromY, enemyX, enemyY);
                const angleDiff = Math.abs(Phaser.Math.Angle.ShortestBetween(angle, enemyAngle));
                
                // 放宽命中角度，将角度转换为度数并扩大容差
                const maxAngleDiff = Math.max(angleError * 180 / Math.PI, 15); // 至少15度的容差
                return angleDiff < maxAngleDiff;
            });
            
            // 只对最近的敌人造成伤害（避免多个敌人同时受伤的问题）
            if (potentialEnemies.length > 0) {
                // 按距离排序，选择最近的敌人
                potentialEnemies.sort((a, b) => {
                    const distA = Phaser.Math.Distance.Between(fromX, fromY, a.body.x, a.body.y);
                    const distB = Phaser.Math.Distance.Between(fromX, fromY, b.body.x, b.body.y);
                    return distA - distB;
                });
                
                // 只对最近的敌人造成伤害
                const closestEnemy = potentialEnemies[0];
                this.damageEnemy(closestEnemy, weapon.damage);
            }
            
        } catch (error) {
            console.error('检查子弹击中时出错:', error);
        }
    }
    
    // 处理可破坏物体被击中
    private handleDestructibleHit(destructible: any, weapon: any) {
        try {
            // 减少生命值或直接销毁
            if (destructible.data && destructible.data.has('health')) {
                const health = destructible.data.get('health') - weapon.damage;
                if (health <= 0) {
                    this.createDestructionEffect(destructible.x, destructible.y);
                    this.dropItem(destructible.x, destructible.y);
                    destructible.destroy();
                } else {
                    destructible.data.set('health', health);
                    // 显示受伤效果
                    this.tweens.add({
                        targets: destructible,
                        alpha: 0.5,
                        duration: 100,
                        yoyo: true,
                        ease: 'Power2'
                    });
                }
            } else {
                // 如果没有生命值数据，直接销毁
                this.createDestructionEffect(destructible.x, destructible.y);
                this.dropItem(destructible.x, destructible.y);
                destructible.destroy();
            }
        } catch (error) {
            console.error('处理可破坏物体击中时出错:', error);
        }
    }
    
    // 添加装饰元素
    private addDecorations() {
        try {
            const gridSize = 80;
            
            // 房间定义（网格坐标）
            const rooms = {
                start: { x: 10, y: 10, width: 10, height: 8 },
                main: { x: 24, y: 10, width: 12, height: 10 },
                left: { x: 10, y: 22, width: 8, height: 6 }
            };
            
            // 辅助函数：将房间内的相对坐标转换为世界坐标
            const getRoomPos = (room: string, offsetX: number, offsetY: number) => {
                const roomDef = rooms[room as keyof typeof rooms];
                if (!roomDef) return { x: offsetX * gridSize, y: offsetY * gridSize };
                return {
                    x: (roomDef.x + offsetX) * gridSize,
                    y: (roomDef.y + offsetY) * gridSize
                };
            };
            
            // 添加几个装饰性的箱子（基于房间位置）
            const cratePositions = [
                { ...getRoomPos('start', 5, 3), },
                { ...getRoomPos('main', 4, 3), },
                { ...getRoomPos('main', 8, 6), },
                { ...getRoomPos('left', 4, 2), }
            ];
            
            cratePositions.forEach(pos => {
                const crate = this.add.graphics();
                crate.fillStyle(0x8B4513, 1);
                crate.fillRect(-20, -20, 40, 40);
                crate.lineStyle(2, 0x654321, 1);
                crate.strokeRect(-20, -20, 40, 40);
                crate.fillStyle(0x654321, 1);
                crate.fillRect(-20, -5, 40, 10);
                crate.fillRect(-5, -20, 10, 40);
                crate.setPosition(pos.x, pos.y);
                crate.setDepth(50);
                
                // 添加碰撞体
                const crateBody = this.walls.create(pos.x, pos.y, '');
                if (crateBody) {
                    crateBody.body.setSize(40, 40);
                    crateBody.body.immovable = true;
                }
            });
            
            // 添加交互物体
            this.addInteractiveObjects();
            
            // 添加可破坏物体
            this.addDestructibleObjects();
            
            // 添加动态门
            this.addDoors();
            
            console.log('装饰元素和交互功能添加成功');
            
        } catch (error) {
            console.error('添加装饰元素时出错:', error);
        }
    }
    
    // 添加交互物体
    private addInteractiveObjects() {
        try {
            const gridSize = 80;
            
            // 房间定义（网格坐标）
            const rooms = {
                start: { x: 10, y: 10, width: 10, height: 8 },
                left: { x: 10, y: 22, width: 8, height: 6 },
                main: { x: 24, y: 10, width: 12, height: 10 },
                right: { x: 40, y: 10, width: 8, height: 8 },
                treasure: { x: 24, y: 24, width: 10, height: 8 },
                evac: { x: 36, y: 22, width: 8, height: 6 },
                safe: { x: 5, y: 15, width: 5, height: 5 },
                supply: { x: 24, y: 5, width: 8, height: 5 }
            };
            
            // 辅助函数：将房间内的相对坐标转换为世界坐标
            const getRoomPos = (room: string, offsetX: number, offsetY: number) => {
                const roomDef = rooms[room as keyof typeof rooms];
                if (!roomDef) return { x: offsetX * gridSize, y: offsetY * gridSize };
                return {
                    x: (roomDef.x + offsetX) * gridSize,
                    y: (roomDef.y + offsetY) * gridSize
                };
            };
            
            // 定义多种类型的交互物体，基于地图网格系统
            const interactiveObjects = [
                // 起始房间 - 补给终端
                { ...getRoomPos('start', 2, 3), type: 'terminal', color: 0x0099CC, name: '补给终端' },
                
                // 中央大厅 - 多个终端
                { ...getRoomPos('main', 3, 4), type: 'terminal', color: 0x0099CC, name: '战术终端' },
                { ...getRoomPos('main', 8, 4), type: 'terminal', color: 0x0099CC, name: '装备终端' },
                { ...getRoomPos('main', 6, 6), type: 'terminal', color: 0x0099CC, name: '指挥终端' },
                
                // 右侧房间 - 资源终端
                { ...getRoomPos('right', 4, 4), type: 'terminal', color: 0x0099CC, name: '资源终端' },
                
                // 能量核心 - 分布在各个房间
                { ...getRoomPos('main', 5, 5), type: 'powerCore', color: 0xFF6600, name: '能量核心' },
                { ...getRoomPos('treasure', 5, 4), type: 'powerCore', color: 0xFF6600, name: '高级能量核心' },
                { ...getRoomPos('right', 3, 3), type: 'powerCore', color: 0xFF6600, name: '超级能量核心' },
                
                // 数据存储设备
                { ...getRoomPos('left', 4, 3), type: 'dataDrive', color: 0x00CCFF, name: '数据存储' },
                { ...getRoomPos('treasure', 4, 4), type: 'dataDrive', color: 0x00CCFF, name: '机密数据' },
                
                // 医疗站
                { ...getRoomPos('main', 4, 3), type: 'medStation', color: 0xFF3366, name: '医疗站' },
                { ...getRoomPos('treasure', 6, 4), type: 'medStation', color: 0xFF3366, name: '高级医疗站' },
                
                // 军械库终端
                { ...getRoomPos('right', 4, 3), type: 'armory', color: 0x6600FF, name: '军械库' },
                { ...getRoomPos('left', 3, 2), type: 'armory', color: 0x6600FF, name: '武器库' },
                
                // 补给站房间
                { ...getRoomPos('supply', 4, 2.5), type: 'terminal', color: 0x0099CC, name: '补给终端' }
            ];
            
            interactiveObjects.forEach(pos => {
                const obj = this.physics.add.sprite(pos.x, pos.y, '');
                obj.setSize(40, 40);
                obj.setImmovable(true);
                obj.setData('type', pos.type);
                obj.setData('active', true);
                obj.setData('name', pos.name);
                obj.setData('color', pos.color);
                
                // 创建基础图形
                const graphic = this.add.graphics();
                graphic.setDepth(50);
                
                // 根据类型添加不同的视觉特征和动画
                switch (pos.type) {
                    case 'terminal':
                        // 终端样式 - 方形带边框
                        graphic.fillStyle(pos.color, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0xFFFFFF, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        
                        // 添加终端细节 - 更丰富的界面
                        graphic.fillStyle(0xFFFFFF, 0.5);
                        graphic.fillRect(-10, -5, 20, 10);
                        graphic.fillRect(-5, -10, 10, 20);
                        
                        // 终端按钮
                        graphic.fillStyle(0x00FF00, 1);
                        graphic.fillCircle(0, 0, 4);
                        
                        // 终端屏幕
                        graphic.fillStyle(0x000000, 0.8);
                        graphic.fillRect(-15, -15, 30, 10);
                        
                        // 添加终端脉冲效果
                        const terminalPulse = this.add.graphics();
                        terminalPulse.fillStyle(pos.color, 0.2);
                        terminalPulse.fillRect(-25, -25, 50, 50);
                        terminalPulse.setPosition(pos.x, pos.y);
                        terminalPulse.setDepth(49);
                        
                        this.tweens.add({
                            targets: terminalPulse,
                            scale: { from: 1, to: 1.3, yoyo: true },
                            alpha: { from: 0.2, to: 0, yoyo: true },
                            duration: 2500,
                            repeat: -1,
                            ease: 'Power2.easeInOut'
                        });
                        
                        obj.setData('pulseGraphic', terminalPulse);
                        break;
                        
                    case 'powerCore':
                        // 能量核心 - 圆形设计
                        graphic.fillStyle(pos.color, 1);
                        graphic.fillCircle(0, 0, 20);
                        
                        // 添加能量光晕 - 多层效果
                        graphic.fillStyle(0xFFFF00, 0.4);
                        graphic.fillCircle(0, 0, 15);
                        
                        // 添加辐射状线条
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI * 2 / 6) * i;
                            graphic.save();
                        graphic.setPosition(0, 0);
                        graphic.setRotation(angle);
                            graphic.fillStyle(0xFFFF00, 0.6);
                            graphic.fillRect(-2, -25, 4, 10);
                            graphic.restore();
                        }
                        
                        // 能量脉冲效果 - 更强烈的动画
                        const pulseGraphic = this.add.graphics();
                        pulseGraphic.fillStyle(pos.color, 0.3);
                        pulseGraphic.fillCircle(0, 0, 30);
                        pulseGraphic.setPosition(pos.x, pos.y);
                        pulseGraphic.setDepth(49);
                        
                        this.tweens.add({
                            targets: pulseGraphic,
                            scale: { from: 1, to: 1.5, yoyo: true },
                            alpha: { from: 0.3, to: 0, yoyo: true },
                            duration: 1500,
                            repeat: -1,
                            ease: 'Cubic.easeInOut'
                        });
                        
                        obj.setData('pulseGraphic', pulseGraphic);
                        
                        // 核心闪烁效果
                        this.tweens.add({
                            targets: graphic,
                            scale: { from: 1, to: 1.05, yoyo: true },
                            duration: 1000,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                        break;
                        
                    case 'dataDrive':
                        // 数据存储 - 矩形带发光边缘
                        graphic.fillStyle(pos.color, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(2, 0x00FFFF, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        
                        // 数据线条 - 动态感
                        graphic.lineStyle(1, 0x00FFFF, 0.8);
                        for (let i = 0; i < 4; i++) {
                            const yPos = -15 + i * 10;
                            graphic.beginPath();
                            graphic.moveTo(-15, yPos);
                            graphic.lineTo(15, yPos);
                            graphic.stroke();
                        }
                        
                        // 添加数据流动效果
                        const dataLines: Phaser.GameObjects.Graphics[] = [];
                        for (let i = 0; i < 3; i++) {
                            const line = this.add.graphics();
                            line.lineStyle(1, 0x00FFFF, 1);
                            line.setPosition(pos.x, pos.y);
                            line.setDepth(51);
                            dataLines.push(line);
                        }
                        
                        // 数据流动动画
                        let lineIndex = 0;
                        this.time.addEvent({
                            delay: 500,
                            repeat: -1,
                            callback: () => {
                                const line = dataLines[lineIndex];
                                line.clear();
                                line.beginPath();
                                const yPos = -15 + Math.floor(Math.random() * 4) * 10;
                                line.moveTo(-15, yPos);
                                line.lineTo(15, yPos);
                                line.stroke();
                                
                                this.tweens.add({
                                    targets: line,
                                    alpha: { from: 1, to: 0 },
                                    duration: 300,
                                    onComplete: () => line.clear()
                                });
                                
                                lineIndex = (lineIndex + 1) % dataLines.length;
                            }
                        });
                        
                        obj.setData('dataLines', dataLines);
                        break;
                        
                    case 'medStation':
                        // 医疗站 - 十字标志
                        graphic.fillStyle(pos.color, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0xFF0000, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        
                        // 医疗十字 - 更突出的设计
                        graphic.fillStyle(0xFFFFFF, 1);
                        graphic.fillRect(-5, -15, 10, 30);
                        graphic.fillRect(-15, -5, 30, 10);
                        
                        // 医疗站光环效果
                        const medGlow = this.add.graphics();
                        medGlow.fillStyle(0xFF0000, 0.2);
                        medGlow.fillCircle(0, 0, 35);
                        medGlow.setPosition(pos.x, pos.y);
                        medGlow.setDepth(49);
                        
                        this.tweens.add({
                            targets: medGlow,
                            scale: { from: 1, to: 1.2, yoyo: true },
                            alpha: { from: 0.2, to: 0, yoyo: true },
                            duration: 2000,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                        
                        obj.setData('medGlow', medGlow);
                        break;
                        
                    case 'armory':
                        // 军械库 - 武器图标和装甲风格
                        graphic.fillStyle(pos.color, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0x9900FF, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        
                        // 更详细的武器图标
                        graphic.fillStyle(0x9900FF, 1);
                        graphic.fillRect(-10, -5, 20, 10); // 枪身
                        graphic.fillRect(10, -10, 5, 20); // 枪管
                        graphic.fillRect(-5, 5, 10, 5); // 弹匣
                        
                        // 军械库能量盾效果
                        const armorShield = this.add.graphics();
                        armorShield.lineStyle(2, 0x9900FF, 0.3);
                        armorShield.strokeCircle(0, 0, 30);
                        armorShield.setPosition(pos.x, pos.y);
                        armorShield.setDepth(49);
                        
                        this.tweens.add({
                            targets: armorShield,
                            scale: { from: 1, to: 1.3, yoyo: true },
                            alpha: { from: 0.3, to: 0, yoyo: true },
                            duration: 3000,
                            repeat: -1,
                            ease: 'Power2.easeInOut'
                        });
                        
                        obj.setData('armorShield', armorShield);
                        break;
                }
                
                graphic.setPosition(pos.x, pos.y);
                
                // 添加名称标签（可选显示）
                const nameTag = this.add.text(pos.x, pos.y + 30, pos.name, {
                    fontSize: '12px',
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: { x: 6, y: 2 },
                    fontFamily: 'Arial',
                    // fontWeight: 'bold'
                });
                nameTag.setOrigin(0.5);
                nameTag.setDepth(51);
                nameTag.visible = false; // 默认隐藏
                
                // 为所有物体添加轻微的呼吸效果
                this.tweens.add({
                    targets: graphic,
                    scale: { from: 1, to: 1.02, yoyo: true },
                    duration: 3000 + Math.random() * 2000,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                
                obj.setData('graphic', graphic);
                obj.setData('nameTag', nameTag);
                this.interactiveObjects.add(obj);
            });
            
            console.log(`成功添加 ${interactiveObjects.length} 个交互物体，每个物体都有独特的视觉效果和动画`);
        } catch (error) {
            console.error('添加交互物体时出错:', error);
        }
    }
    
    // 添加可破坏物体
    private addDestructibleObjects() {
        try {
            const gridSize = 80;
            
            // 房间定义（网格坐标）
            const rooms = {
                start: { x: 10, y: 10, width: 10, height: 8 },
                left: { x: 10, y: 22, width: 8, height: 6 },
                main: { x: 24, y: 10, width: 12, height: 10 },
                right: { x: 40, y: 10, width: 8, height: 8 },
                treasure: { x: 24, y: 24, width: 10, height: 8 }
            };
            
            // 辅助函数：将房间内的相对坐标转换为世界坐标
            const getRoomPos = (room: string, offsetX: number, offsetY: number) => {
                const roomDef = rooms[room as keyof typeof rooms];
                if (!roomDef) return { x: offsetX * gridSize, y: offsetY * gridSize };
                return {
                    x: (roomDef.x + offsetX) * gridSize,
                    y: (roomDef.y + offsetY) * gridSize
                };
            };
            
            // 定义可破坏物体的位置（基于房间内相对位置）
            const destructiblePositions = [
                // 起始房间
                { ...getRoomPos('start', 4, 4), health: 100, type: 'box', color: 0x8B4513 },
                // 中央大厅
                { ...getRoomPos('main', 3, 5), health: 100, type: 'box', color: 0x8B4513 },
                { ...getRoomPos('main', 9, 5), health: 150, type: 'crate', color: 0x4A4A4A },
                // 左侧房间
                { ...getRoomPos('left', 3, 3), health: 100, type: 'box', color: 0x8B4513 },
                // 右侧房间
                { ...getRoomPos('right', 3, 4), health: 150, type: 'crate', color: 0x4A4A4A },
                // 宝藏房间
                { ...getRoomPos('treasure', 3, 5), health: 150, type: 'crate', color: 0x4A4A4A },
                { ...getRoomPos('treasure', 7, 5), health: 200, type: 'crate', color: 0x2A2A2A }
            ];
            
            destructiblePositions.forEach(pos => {
                const obj = this.physics.add.sprite(pos.x, pos.y, '');
                obj.setSize(50, 50);
                obj.setImmovable(true);
                obj.setData('type', pos.type);
                obj.setData('health', pos.health);
                obj.setData('maxHealth', pos.health);
                
                const graphic = this.add.graphics();
                graphic.fillStyle(pos.color, 1);
                graphic.fillRect(-25, -25, 50, 50);
                graphic.lineStyle(2, 0x666666, 1);
                graphic.strokeRect(-25, -25, 50, 50);
                
                // 添加细节
                if (pos.type === 'crate') {
                    graphic.lineStyle(1, 0x444444, 0.8);
                    graphic.strokeRect(-20, -20, 40, 40);
                    graphic.fillStyle(0x666666, 1);
                    graphic.fillRect(-15, -5, 30, 10);
                }
                
                graphic.setPosition(pos.x, pos.y);
                obj.setData('graphic', graphic);
                
                this.destructibleObjects.add(obj);
            });
        } catch (error) {
            console.error('添加可破坏物体时出错:', error);
        }
    }
    
    // 添加门（可选的门，用于需要特殊条件开启的房间）
    private addDoors() {
        try {
            const gridSize = 80;
            
            // 门的位置基于地图网格系统（可选，某些房间可以有关闭的门）
            // 大部分房间通过走廊直接连接，不需要门
            // 这里可以添加一些需要特殊条件开启的门
            const doorPositions: any[] = [
                // 示例：宝藏房间可以有一个需要钥匙的门（可选）
                // { x: (24 + 5) * gridSize, y: 24 * gridSize, width: 40, height: 80, horizontal: false, closed: true, color: 0x555555 },
            ];
            
            doorPositions.forEach(pos => {
                const door = this.physics.add.sprite(pos.x, pos.y, '');
                door.setSize(pos.width, pos.height);
                door.setImmovable(true);
                door.setData('type', 'door');
                door.setData('closed', pos.closed);
                door.setData('horizontal', pos.horizontal);
                door.setData('animating', false);
                door.setData('animationProgress', 0);
                
                const graphic = this.add.graphics();
                graphic.fillStyle(pos.color, 1);
                graphic.fillRect(-pos.width/2, -pos.height/2, pos.width, pos.height);
                
                // 添加门把手和细节
                graphic.fillStyle(0xAA6622, 1);
                if (pos.horizontal) {
                    graphic.fillCircle(-10, 0, 5);
                    graphic.fillCircle(10, 0, 5);
                } else {
                    graphic.fillCircle(0, -10, 5);
                }
                
                graphic.setPosition(pos.x, pos.y);
                door.setData('graphic', graphic);
                
                this.doors.add(door);
            });
        } catch (error) {
            console.error('添加门时出错:', error);
        }
    }
    
    // 检查交互物体
    private checkInteractiveObjects() {
        try {
            if (!this.playerBody) return;
            
            // 检查玩家是否与交互物体接近
            this.interactiveObjects.getChildren().forEach((obj: any) => {
                if (!obj.active || !obj.getData('active')) return;
                
                const distance = Phaser.Math.Distance.Between(
                    this.playerBody.x, this.playerBody.y,
                    obj.x, obj.y
                );
                
                const type = obj.getData('type');
                // const _color = obj.getData('color') || 0x0099CC;
                const graphic = obj.getData('graphic');
                
                // 根据物体类型设置不同的交互距离
                const interactionDistance = type === 'powerCore' ? 130 : 120;
                
                // 玩家接近交互物体时高亮
                if (distance < interactionDistance) { 
                    // 高亮效果 - 根据物体类型定制视觉反馈
                    if (graphic && !obj.getData('isHighlighted')) {
                        obj.setData('isHighlighted', true);
                        
                        // 保存原始图形状态
                        if (!obj.getData('originalGraphic')) {
                            // 创建临时图形来存储原始样式
                            // 创建并保存原始图形
                            obj.setData('originalGraphic', graphic.clone());
                        }
                        
                        // 根据物体类型定制高亮效果
                        switch (type) {
                            case 'terminal':
                                graphic.clear();
                                graphic.fillStyle(0x0099CC, 0.9);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(4, 0xFFFF00, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                break;
                            case 'powerCore':
                                graphic.clear();
                                graphic.fillStyle(0xFF6600, 1);
                                graphic.fillCircle(0, 0, 22);
                                graphic.fillStyle(0xFFFF00, 0.6);
                                graphic.fillCircle(0, 0, 17);
                                break;
                            case 'dataDrive':
                                graphic.clear();
                                graphic.fillStyle(0x00CCFF, 0.9);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(3, 0x00FFFF, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                break;
                            case 'medStation':
                                graphic.clear();
                                graphic.fillStyle(0xFF3366, 0.9);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(4, 0xFFFFFF, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                graphic.fillStyle(0xFFFFFF, 1);
                                graphic.fillRect(-5, -15, 10, 30);
                                graphic.fillRect(-15, -5, 30, 10);
                                break;
                            case 'armory':
                                graphic.clear();
                                graphic.fillStyle(0x6600FF, 0.9);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(4, 0x9900FF, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                break;
                        }
                    }
                    
                    // 添加接近时的脉冲动画效果
                    if (distance < interactionDistance * 0.8) {
                        if (!obj.getData('hasProximityEffect')) {
                            obj.setData('hasProximityEffect', true);
                            
                            const proximityEffect = this.add.graphics();
                            // 使用对象的颜色数据或默认颜色
                            const objectColor = obj.getData('color') || 0x0099CC;
                            proximityEffect.fillStyle(objectColor, 0.2);
                            
                            if (type === 'powerCore') {
                                proximityEffect.fillCircle(0, 0, 40);
                            } else {
                                proximityEffect.fillRect(-30, -30, 60, 60);
                            }
                            
                            proximityEffect.setPosition(obj.x, obj.y);
                            proximityEffect.setDepth(40);
                            obj.setData('proximityEffect', proximityEffect);
                            
                            this.tweens.add({
                                targets: proximityEffect,
                                scale: { from: 1, to: 1.5 },
                                alpha: { from: 0.2, to: 0 },
                                duration: 1000,
                                repeat: -1,
                                yoyo: true,
                                ease: 'Sine.easeInOut'
                            });
                        }
                    }
                    
                    // 显示名称标签
                    const nameTag = obj.getData('nameTag');
                    if (nameTag && !nameTag.visible) {
                        nameTag.visible = true;
                        
                        // 名称标签淡入动画
                        this.tweens.add({
                            targets: nameTag,
                            alpha: { from: 0, to: 1 },
                            scale: { from: 0.8, to: 1 },
                            duration: 300,
                            ease: 'Back.easeOut'
                        });
                    }
                    
                    // 显示交互提示 - 更醒目的样式
                    if (!obj.getData('showingPrompt')) {
                        const prompt = this.add.text(obj.x, obj.y - 50, '按 E 键交互', {
                            fontSize: '16px',
                            color: '#FFFF00',
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            padding: { x: 12, y: 6 },
                            fontFamily: 'Arial',
                            // fontWeight: 'bold'
                        });
                        prompt.setOrigin(0.5);
                        prompt.setDepth(100);
                        obj.setData('prompt', prompt);
                        obj.setData('showingPrompt', true);
                        
                        // 提示文本的呼吸动画
                        this.tweens.add({
                            targets: prompt,
                            scale: [
                                { value: 1 },
                                { value: 1.1 },
                                { value: 1 }
                            ],
                            duration: 1200,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                    
                    // 检测E键交互 - 使用justDown确保只触发一次
                    if (this.keys && (this.keys as any).e && Phaser.Input.Keyboard.JustDown((this.keys as any).e)) {
                        console.log(`与${obj.getData('name') || '交互物体'}交互成功`);
                        this.interactWithObject(obj);
                    }
                } else {
                    // 恢复正常显示
                    if (graphic && obj.getData('isHighlighted')) {
                        obj.setData('isHighlighted', false);
                        
                        // 根据物体类型恢复原始外观
                        graphic.clear();
                        // 从对象获取颜色数据或使用默认颜色
                        const objectColor = obj.getData('color') || 0x0099CC;
                        switch (type) {
                            case 'terminal':
                                graphic.fillStyle(objectColor, 0.8);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(3, 0xFFFFFF, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                graphic.fillStyle(0xFFFFFF, 0.5);
                                graphic.fillRect(-10, -5, 20, 10);
                                graphic.fillRect(-5, -10, 10, 20);
                                break;
                            case 'powerCore':
                                graphic.fillStyle(objectColor, 1);
                                graphic.fillCircle(0, 0, 20);
                                graphic.fillStyle(0xFFFF00, 0.4);
                                graphic.fillCircle(0, 0, 15);
                                break;
                            case 'dataDrive':
                                graphic.fillStyle(objectColor, 0.8);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(2, 0x00FFFF, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                break;
                            case 'medStation':
                                graphic.fillStyle(objectColor, 0.8);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(3, 0xFF0000, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                graphic.fillStyle(0xFFFFFF, 1);
                                graphic.fillRect(-5, -15, 10, 30);
                                graphic.fillRect(-15, -5, 30, 10);
                                break;
                            case 'armory':
                                graphic.fillStyle(objectColor, 0.8);
                                graphic.fillRect(-20, -20, 40, 40);
                                graphic.lineStyle(3, 0x9900FF, 1);
                                graphic.strokeRect(-20, -20, 40, 40);
                                break;
                        }
                    }
                    
                    // 移除接近效果
                    if (obj.getData('hasProximityEffect')) {
                        obj.setData('hasProximityEffect', false);
                        const effect = obj.getData('proximityEffect');
                        if (effect) {
                            effect.destroy();
                        }
                    }
                    
                    // 隐藏名称标签
                    const nameTag = obj.getData('nameTag');
                    if (nameTag && nameTag.visible) {
                        // 名称标签淡出动画
                        this.tweens.add({
                            targets: nameTag,
                            alpha: { from: 1, to: 0 },
                            scale: { from: 1, to: 0.8 },
                            duration: 200,
                            onComplete: () => {
                                nameTag.visible = false;
                                nameTag.alpha = 1;
                                nameTag.scale = 1;
                            }
                        });
                    }
                    
                    // 隐藏提示
                    if (obj.getData('showingPrompt')) {
                        const prompt = obj.getData('prompt');
                        if (prompt) {
                            // 提示淡出动画
                            this.tweens.add({
                                targets: prompt,
                                alpha: { from: 1, to: 0 },
                                scale: { from: 1, to: 0.9 },
                                duration: 200,
                                onComplete: () => prompt.destroy()
                            });
                        }
                        obj.setData('showingPrompt', false);
                    }
                }
            });
        } catch (error) {
            console.error('检查交互物体时出错:', error);
        }
    }
    
    // 与物体交互
    private interactWithObject(obj: any) {
        try {
            const type = obj.getData('type');
            const name = obj.getData('name') || '交互物体';
            
            // 根据物体类型创建相应颜色的交互效果
            let effectColor = 0x00FF00; // 默认绿色
            switch (type) {
                case 'terminal': effectColor = 0x0099CC; break;
                case 'powerCore': effectColor = 0xFF6600; break;
                case 'dataDrive': effectColor = 0x00CCFF; break;
                case 'medStation': effectColor = 0xFF3366; break;
                case 'armory': effectColor = 0x6600FF; break;
            }
            
            // 创建更丰富的交互效果 - 多层动画
            const effect1 = this.add.graphics();
            effect1.fillStyle(effectColor, 0.6);
            effect1.fillCircle(0, 0, 30);
            effect1.setPosition(obj.x, obj.y);
            
            const effect2 = this.add.graphics();
            effect2.fillStyle(0xFFFF00, 0.4);
            effect2.fillCircle(0, 0, 20);
            effect2.setPosition(obj.x, obj.y);
            
            // 双重动画效果
            this.tweens.add({
                targets: effect1,
                scale: { from: 1, to: 2.5 },
                alpha: { from: 0.6, to: 0 },
                duration: 800,
                onComplete: () => effect1.destroy()
            });
            
            this.tweens.add({
                targets: effect2,
                scale: { from: 1, to: 1.5 },
                alpha: { from: 0.4, to: 0 },
                duration: 600,
                onComplete: () => effect2.destroy()
            });
            
            // 添加粒子效果 - 根据物体类型改变颜色
            for (let i = 0; i < 8; i++) {
                const particle = this.add.graphics();
                const angle = (i / 8) * Math.PI * 2;
                const distance = 25;
                
                // 粒子颜色变化
                let particleColor = effectColor;
                if (i % 2 === 0) {
                    particleColor = 0xFFFFFF;
                }
                
                particle.fillStyle(particleColor, 1);
                particle.fillCircle(0, 0, 5);
                particle.setPosition(
                    obj.x + Math.cos(angle) * distance,
                    obj.y + Math.sin(angle) * distance
                );
                
                this.tweens.add({
                    targets: particle,
                    x: obj.x + Math.cos(angle) * (distance + 60),
                    y: obj.y + Math.sin(angle) * (distance + 60),
                    alpha: { from: 1, to: 0 },
                    scale: { from: 1, to: 0 },
                    duration: 800,
                    onComplete: () => particle.destroy()
                });
            }
            
            // 播放交互音效（如果有音频系统）
            console.log(`与${name}交互成功，播放音效`);
            
            // 根据类型执行不同的交互
            switch (type) {
                case 'terminal':
                    this.interactWithTerminal(obj);
                    break;
                case 'powerCore':
                    this.interactWithPowerCore(obj);
                    break;
                case 'dataDrive':
                    this.interactWithDataDrive(obj);
                    break;
                case 'medStation':
                    this.interactWithMedStation(obj);
                    break;
                case 'armory':
                    this.interactWithArmory(obj);
                    break;
                default:
                    // 默认交互行为
                    const defaultMessage = '交互成功!';
                    this.showInteractionMessage(obj, defaultMessage, '#00FF00');
                    break;
            }
            
            // 显示物体名称标签
            const nameTag = obj.getData('nameTag');
            if (nameTag) {
                nameTag.visible = true;
                setTimeout(() => {
                    nameTag.visible = false;
                }, 2000);
            }
            
        } catch (error) {
            console.error('与物体交互时出错:', error);
        }
    }
    
    // 与终端交互
    private interactWithTerminal(obj: any) {
        // 更丰富的奖励系统
        const rewardTypes = [
            { type: 'health', amount: 30, message: '获得生命值!', color: '#FF0000' },
            { type: 'armor', amount: 20, message: '获得护甲!', color: '#0066CC' },
            { type: 'money', min: 100, max: 300, messagePrefix: '获得 ', messageSuffix: ' 金钱!', color: '#FFD700' },
            { type: 'boost', message: '移动速度提升!', color: '#00FF00' },
            { type: 'weapon', message: '获得强力武器!', color: '#FF6600' }
        ];
        
        // 根据游戏进度调整奖励概率
        let reward;
        const random = Math.random();
        
        if (random < 0.3) {
            reward = rewardTypes[0]; // 生命值
        } else if (random < 0.5) {
            reward = rewardTypes[1]; // 护甲
        } else if (random < 0.7) {
            reward = rewardTypes[2]; // 金钱
        } else if (random < 0.9) {
            reward = rewardTypes[3]; // 速度提升
        } else {
            reward = rewardTypes[4]; // 武器
        }
        
        // 执行奖励
        let message = '';
        let color = reward.color || '#00FF00';
        
        switch (reward.type) {
            case 'health':
                (this as any).playerHealth = Math.min(((this as any).playerHealth || 0) + (reward.amount || 0), (this as any).playerMaxHealth || 100);
                this.updateHealthBar?.();
                message = reward.message || '';
                break;
            case 'armor':
                (this as any).playerArmor = Math.min(((this as any).playerArmor || 0) + (reward.amount || 0), 100);
                this.updateArmorBar?.();
                message = reward.message || '';
                break;
            case 'money':
                const rewardMax = reward.max || 100;
                const rewardMin = reward.min || 0;
                const amount = Math.floor(Math.random() * (rewardMax - rewardMin + 1)) + rewardMin;
                (this as any).playerMoney = ((this as any).playerMoney || 0) + amount;
                this.moneyText?.setText(`金钱: ${(this as any).playerMoney}`);
                const prefix = reward.messagePrefix || '';
                const suffix = reward.messageSuffix || '';
                message = `${prefix}${amount}${suffix}`;
                break;
            case 'boost':
                // 临时提升移动速度
                const originalSpeed = (this as any).playerSpeed || 100;
                (this as any).playerSpeed = originalSpeed * 1.3; // 提升30%速度
                message = reward.message || '';
                
                // 5秒后恢复
                setTimeout(() => {
                    (this as any).playerSpeed = originalSpeed;
                    this.showNotification('速度提升结束', '#FFAA00');
                }, 5000);
                break;
            case 'weapon':
                // 为了简化，这里只是显示消息
                message = reward.message || '';
                break;
        }
        
        // 显示交互消息
        this.showInteractionMessage(obj, message, color);
        
        // 终端使用后的状态变化 - 添加冷却时间视觉效果
        const graphic = obj.getData('graphic');
        if (graphic) {
            graphic.clear();
            graphic.fillStyle(0x333333, 0.8); // 灰色表示冷却中
            graphic.fillRect(-20, -20, 40, 40);
            graphic.lineStyle(2, 0x666666, 1);
            graphic.strokeRect(-20, -20, 40, 40);
        }
        
        // 禁用一段时间
        obj.setData('active', false);
        setTimeout(() => {
            if (graphic) {
                // 恢复原始外观
                graphic.clear();
                graphic.fillStyle(0x0099CC, 0.8);
                graphic.fillRect(-20, -20, 40, 40);
                graphic.lineStyle(2, 0xFFFFFF, 1);
                graphic.strokeRect(-20, -20, 40, 40);
            }
            obj.setData('active', true);
        }, 8000); // 减少冷却时间，提高游戏节奏
    }
    
    // 显示交互消息
    private showInteractionMessage(obj: any, message: string, color: string) {
        try {
            // 创建消息背景板
            const background = this.add.graphics();
            const textWidth = 18 * message.length * 0.6;
            const textHeight = 24;
            const padding = 15;
            
            // 解析颜色为数字
            const colorNum = Phaser.Display.Color.HexStringToColor(color).color;
            
            background.fillStyle(0x000000, 0.95);
            background.fillRoundedRect(-textWidth/2 - padding, -textHeight/2 - padding, 
                                       textWidth + padding * 2, textHeight + padding * 2, 8);
            
            // 添加发光边框效果
            background.lineStyle(2, colorNum, 0.8);
            background.strokeRoundedRect(-textWidth/2 - padding, -textHeight/2 - padding, 
                                        textWidth + padding * 2, textHeight + padding * 2, 8);
            
            // 创建消息文本
            const msgText = this.add.text(0, 0, message, {
                fontSize: '18px',
                color: color,
                fontFamily: 'Arial',
                // fontWeight: 'bold',
                align: 'center'
            });
            msgText.setOrigin(0.5);
            
            // 创建容器组合背景和文本
            const container = this.add.container(obj.x, obj.y - 70, [background, msgText]);
            container.setDepth(150);
            
            // 添加更丰富的粒子效果
            this.addParticles(obj.x, obj.y, typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color, 8, 1000);
            this.addParticles(obj.x, obj.y, 0xFFFFFF, 6, 800);
            
            // 根据文本内容类型添加额外的视觉效果
            if (message.includes('医疗') || message.includes('生命值')) {
                this.addHealthEffect(obj.x, obj.y);
            } else if (message.includes('武器') || message.includes('攻击') || message.includes('弹药')) {
                this.addWeaponEffect(obj.x, obj.y);
            } else if (message.includes('护甲') || message.includes('防御')) {
                this.addArmorEffect(obj.x, obj.y);
            } else if (message.includes('金钱') || message.includes('金币')) {
                this.addMoneyEffect(obj.x, obj.y);
            }
            
            // 创建动画序列 - 使用tweens.add替代timeline
            this.tweens.add({
                targets: container,
                y: obj.y - 60,
                scale: { from: 0.9, to: 1.1 },
                duration: 300,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // 短暂停留后上升并淡出
                    setTimeout(() => {
                        this.tweens.add({
                            targets: container,
                            y: obj.y - 120,
                            alpha: { from: 1, to: 0 },
                            scale: { from: 1.1, to: 0.9 },
                            duration: 1400,
                            ease: 'Power2.easeOut',
                            onComplete: () => {
                                container.destroy();
                            }
                        });
                    }, 300);
                }
            });
            
            // 文字闪烁效果
            this.tweens.add({
                targets: msgText,
                color: [color, '#FFFFFF', color],
                duration: 1000,
                repeat: -1
            });
            
        } catch (error) {
            console.error('显示交互消息时出错:', error);
        }
    }
    
    // 健康效果动画
    private addHealthEffect(x: number, y: number) {
        const healthEffect = this.add.graphics();
        healthEffect.fillStyle(0x00FF00, 0.3);
        healthEffect.fillCircle(0, 0, 30);
        healthEffect.setPosition(x, y);
        healthEffect.setDepth(45);
        
        this.tweens.add({
            targets: healthEffect,
            scale: { from: 1, to: 1.5 },
            alpha: { from: 0.3, to: 0 },
            duration: 1200,
            ease: 'Power2.easeOut',
            onComplete: () => healthEffect.destroy()
        });
    }
    
    // 武器效果动画
    private addWeaponEffect(x: number, y: number) {
        const weaponEffect = this.add.graphics();
        weaponEffect.lineStyle(3, 0xFF6600, 0.4);
        weaponEffect.strokeCircle(0, 0, 25);
        weaponEffect.setPosition(x, y);
        weaponEffect.setDepth(45);
        
        this.tweens.add({
            targets: weaponEffect,
            scale: { from: 1, to: 1.8 },
            alpha: { from: 0.4, to: 0 },
            duration: 1000,
            ease: 'Power2.easeIn',
            onComplete: () => weaponEffect.destroy()
        });
    }
    
    // 护甲效果动画
    private addArmorEffect(x: number, y: number) {
        const armorEffect = this.add.graphics();
        armorEffect.lineStyle(4, 0x0066FF, 0.3);
        armorEffect.strokeRect(-25, -25, 50, 50);
        armorEffect.setPosition(x, y);
        armorEffect.setDepth(45);
        
        this.tweens.add({
            targets: armorEffect,
            scale: { from: 1, to: 1.6 },
            alpha: { from: 0.3, to: 0 },
            duration: 1200,
            ease: 'Power2.easeOut',
            onComplete: () => armorEffect.destroy()
        });
    }
    
    // 金钱效果动画
    private addMoneyEffect(x: number, y: number) {
        const goldEffect = this.add.graphics();
        goldEffect.fillStyle(0xFFD700, 0.2);
        goldEffect.fillCircle(0, 0, 35);
        goldEffect.setPosition(x, y);
        goldEffect.setDepth(45);
        
        this.tweens.add({
            targets: goldEffect,
            scale: { from: 1, to: 1.4 },
            alpha: { from: 0.2, to: 0 },
            duration: 1000,
            ease: 'Power2.easeInOut',
            onComplete: () => goldEffect.destroy()
        });
    }
    
    // 与军械库交互
    private interactWithArmory(obj: any) {
        // 武器相关奖励
        const rewardTypes = [
            { type: 'ammo', message: '获得弹药补给!', color: '#FF6600' },
            { type: 'damage', message: '武器伤害提升!', color: '#FF0000' },
            { type: 'rapid', message: '射击速度提升!', color: '#CC00FF' },
            { type: 'new', message: '获得新武器!', color: '#00FF00' }
        ];
        
        // 随机选择奖励类型
        const reward = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
        
        // 添加武器特殊效果
        const weaponEffect = this.add.graphics();
        weaponEffect.lineStyle(3, 0x6600FF, 1);
        weaponEffect.strokeCircle(0, 0, 40);
        weaponEffect.setPosition(obj.x, obj.y);
        
        this.tweens.add({
            targets: weaponEffect,
            scale: { from: 1, to: 1.5 },
            alpha: { from: 1, to: 0 },
            duration: 1000,
            onComplete: () => weaponEffect.destroy()
        });
        
        // 执行具体奖励
        switch (reward.type) {
            case 'ammo':
                // 弹药奖励
                if ((this as any).currentAmmo !== undefined && (this as any).maxAmmo !== undefined) {
                    const ammoAmount = 30 + Math.floor(Math.random() * 20); // 30-50弹药
                    (this as any).currentAmmo = Math.min((this as any).currentAmmo + ammoAmount, (this as any).maxAmmo);
                    this.updateWeaponDisplay?.(); // 使用正确的方法名
                    this.showInteractionMessage(obj, `获得 ${ammoAmount} 弹药!`, reward.color);
                }
                break;
            
            case 'damage':
                // 伤害提升
                if ((this as any).weaponDamage !== undefined) {
                    (this as any).weaponDamage += 5;
                    this.showInteractionMessage(obj, '武器伤害永久提升 5 点!', reward.color);
                    this.showNotification('武器升级成功!', '#FF0000');
                }
                break;
            
            case 'rapid':
                // 临时射速提升
                if ((this as any).weaponFireRate !== undefined) {
                    const originalRate = (this as any).weaponFireRate;
                    (this as any).weaponFireRate *= 0.8; // 提升20%射速
                    this.showInteractionMessage(obj, '射击速度提升 20%!', reward.color);
                    
                    // 15秒后恢复
                    setTimeout(() => {
                        (this as any).weaponFireRate = originalRate;
                        this.showNotification('射速提升结束', '#CC00FF');
                    }, 15000);
                }
                break;
            
            case 'new':
                // 新武器提示
                this.showInteractionMessage(obj, '解锁新型武器!', reward.color);
                this.showNotification('武器库更新完成', '#00FF00');
                break;
        }
        
        // 设置冷却
        this.setObjectOnCooldown(obj);
    }
    
    // 与医疗站交互
    private interactWithMedStation(obj: any) {
        // 专注于恢复生命值和提供治疗效果
        
        // 医疗站特效 - 十字形状扩散
        for (let i = 0; i < 4; i++) {
            const crossEffect = this.add.graphics();
            crossEffect.lineStyle(2, 0xFF3366, 0.8);
            
            const angle = (i * Math.PI) / 2;
            const startX = obj.x + Math.cos(angle) * 30;
            const startY = obj.y + Math.sin(angle) * 30;
            const endX = obj.x + Math.cos(angle) * 80;
            const endY = obj.y + Math.sin(angle) * 80;
            
            crossEffect.beginPath();
            crossEffect.moveTo(startX, startY);
            crossEffect.lineTo(endX, endY);
            crossEffect.stroke();
            
            this.tweens.add({
                targets: crossEffect,
                alpha: { from: 0.8, to: 0 },
                duration: 1000,
                onComplete: () => crossEffect.destroy()
            });
        }
        
        // 为玩家添加治疗光环
        if (this.player) {
            const healEffect = this.add.graphics();
            healEffect.fillStyle(0xFF3366, 0.3);
            healEffect.fillCircle(this.player.x, this.player.y, 60);
            
            this.tweens.add({
                targets: healEffect,
                scale: { from: 1, to: 1.5 },
                alpha: { from: 0.3, to: 0 },
                duration: 2000,
                onComplete: () => healEffect.destroy()
            });
        }
        
        // 完全恢复生命值
        const healthGained = Math.min(this.playerMaxHealth || 100, 100 - (this.playerHealth || 0));
        this.playerHealth = 100;
        this.updateHealthBar?.(); // 安全调用
        
        // 恢复部分护甲
        this.playerArmor = Math.min(80, (this.playerArmor || 0) + 30);
        this.updateArmorBar?.(); // 安全调用
        
        this.showInteractionMessage(obj, `完全恢复生命值 +${healthGained}！`, '#FF3366');
        this.showNotification('医疗站治疗完成', '#FF3366');
        
        // 设置冷却
        this.setObjectOnCooldown(obj);
    }
    
    // 与数据存储交互
    private interactWithDataDrive(obj: any) {
        // 数据下载动画
        const downloadBar = this.add.graphics();
        downloadBar.fillStyle(0x00CCFF, 0.8);
        downloadBar.fillRect(obj.x - 30, obj.y + 40, 0, 10); // 初始宽度为0
        
        const downloadText = this.add.text(obj.x, obj.y + 20, '下载中...', {
            fontSize: '14px',
            color: '#00CCFF',
            fontFamily: 'Arial'
        });
        downloadText.setOrigin(0.5);
        
        // 下载进度动画
        this.tweens.add({
            targets: downloadBar,
            width: 60,
            duration: 1500,
            onComplete: () => {
                // 下载完成后给予奖励
                downloadText.setText('下载完成！');
                
                // 大量金钱奖励
                const moneyAmount = 100 + Math.floor(Math.random() * 150); // 100-250金钱
                this.playerMoney = (this.playerMoney || 0) + moneyAmount;
                this.moneyText?.setText(`金钱: ${this.playerMoney}`);
                
                // 显示金钱动画
                this.showMoneyAnimation(obj.x, obj.y, moneyAmount);
                
                // 随机获得一条信息
                const messages = [
                    '发现隐藏地图数据！',
                    '系统已升级！',
                    '解锁成就：数据收集者',
                    '获得秘密任务信息'
                ];
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                
                this.showInteractionMessage(obj, `获得 $${moneyAmount}！`, '#00CCFF');
                this.showNotification(randomMessage, '#00CCFF');
                
                // 清理下载UI
                setTimeout(() => {
                    downloadBar.destroy();
                    downloadText.destroy();
                }, 1000);
                
                // 设置冷却
                this.setObjectOnCooldown(obj);
            }
        });
    }
    
    // 与能量核心交互
    private interactWithPowerCore(obj: any) {
        // 能量核心提供强力临时增益
        const boostTypes = [
            { type: 'damage', factor: 1.5, message: '伤害提升 50%!', color: '#FF0000', duration: 20000 },
            { type: 'defense', factor: 0.5, message: '防御力提升!', color: '#00FF00', duration: 15000 },
            { type: 'speed', factor: 1.4, message: '速度大幅提升!', color: '#FF6600', duration: 25000 },
            { type: 'invincible', message: '短暂无敌!', color: '#CC00FF', duration: 5000 }
        ];
        
        // 随机选择增益类型
        const boost = boostTypes[Math.floor(Math.random() * boostTypes.length)];
        
        // 能量爆发特效
        const burstEffect = this.add.graphics();
        burstEffect.fillStyle(0xFF6600, 0.8);
        burstEffect.fillCircle(obj.x, obj.y, 10);
        
        this.tweens.add({
            targets: burstEffect,
            scale: { from: 1, to: 10 },
            alpha: { from: 0.8, to: 0 },
            duration: 1000,
            onComplete: () => burstEffect.destroy()
        });
        
        // 如果有脉冲效果，临时增强它
        const pulseGraphic = obj.getData('pulseGraphic');
        if (pulseGraphic) {
            pulseGraphic.setAlpha(0.8);
            
            setTimeout(() => {
                if (pulseGraphic) pulseGraphic.setAlpha(0.3);
            }, 2000);
        }
        
        // 执行增益效果
        switch (boost.type) {
            case 'damage':
                if ((this as any).weaponDamage !== undefined) {
                    // 增加武器伤害效果
                    const originalDamage = (this as any).weaponDamage || 1;
                    const factor = boost.factor || 1;
                    (this as any).weaponDamage = originalDamage * factor;
                    this.showInteractionMessage(obj, boost.message, boost.color);
                    
                    setTimeout(() => {
                        // 恢复原始武器伤害
                        (this as any).weaponDamage = originalDamage;
                        this.showNotification('伤害提升结束', boost.color);
                    }, boost.duration);
                }
                break;
                
            case 'defense':
                // 减少受到的伤害
                const originalDefense = (this as any).playerDefense || 0;
                // 添加防御提升效果
                (this as any).playerDefense = boost.factor; // 使用类型断言处理
                this.showInteractionMessage(obj, boost.message, boost.color);
                
                setTimeout(() => {
                    // 恢复原始防御值
                    (this as any).playerDefense = originalDefense;
                    this.showNotification('防御力提升结束', boost.color);
                }, boost.duration);
                break;
                
            case 'speed':
                if (this.playerSpeed !== undefined) {
                    const originalSpeed = this.playerSpeed;
                    // 增加速度效果
                    const factor = boost.factor || 1;
                    (this as any).playerSpeed = ((this as any).playerSpeed || 100) * factor;
                    this.showInteractionMessage(obj, boost.message, boost.color);
                    
                    setTimeout(() => {
                        this.playerSpeed = originalSpeed;
                        this.showNotification('速度提升结束', boost.color);
                    }, boost.duration);
                }
                break;
                
            case 'invincible':
                // 无敌效果 - 添加闪烁动画
                if (this.player) {
                    // 保存原始颜色
                    const originalTint = 0xFFFFFF; // 默认白色
                    
                    // 对于无敌状态，使用fillStyle方法设置颜色
                    if (typeof this.player.fillStyle === 'function') {
                        // 重置为白色
                        this.player.fillStyle(0xFFFFFF, 1);
                    }
                    
                    const blinkInterval = setInterval(() => {
                        // 切换玩家颜色效果（使用正确的fillStyle方法）
                        if (typeof this.player.fillStyle === 'function') {
                            // 使用交替颜色
                            const newColor = 0x00FFFF;
                            this.player.fillStyle(newColor, 1);
                        }
                    }, 200);
                    
                    this.showInteractionMessage(obj, boost.message, boost.color);
                    this.showNotification('无敌模式激活!', boost.color);
                    
                    setTimeout(() => {
                        clearInterval(blinkInterval);
                        // 恢复原始颜色（使用正确的fillStyle方法）
                        if (typeof this.player.fillStyle === 'function') {
                            this.player.fillStyle(originalTint, 1);
                        }
                        this.showNotification('无敌状态结束', boost.color);
                    }, boost.duration);
                }
                break;
        }
        
        // 设置冷却
        this.setObjectOnCooldown(obj);
    }
    
    // 显示金钱动画
    private showMoneyAnimation(x: number, y: number, amount: number) {
        // 主金钱文本
        const moneyText = this.add.text(x, y, `$${amount}`, {
            fontSize: '20px',
            color: '#FFD700',
            // fontWeight: 'bold',
            fontFamily: 'Arial'
        });
        moneyText.setOrigin(0.5);
        
        this.tweens.add({
            targets: moneyText,
            y: y - 70,
            x: x + (Math.random() - 0.5) * 40,
            alpha: { from: 1, to: 0 },
            scale: [
                { value: 1 },
                { value: 1.2 },
                { value: 1 }
            ],
            duration: 1500,
            onComplete: () => moneyText.destroy()
        });
        
        // 添加小金币效果
        for (let i = 0; i < 6; i++) {
            const coin = this.add.text(x, y, '$', {
                fontSize: '14px',
                color: '#FFD700',
                // fontWeight: 'bold',
                fontFamily: 'Arial'
            });
            coin.setOrigin(0.5);
            
            this.tweens.add({
                targets: coin,
                y: y - 40 - Math.random() * 30,
                x: x + (Math.random() - 0.5) * 60,
                alpha: { from: 1, to: 0 },
                rotation: (Math.random() - 0.5) * 4,
                duration: 1000 + Math.random() * 500,
                onComplete: () => coin.destroy()
            });
        }
    }
    
    // 设置物体冷却状态
    private setObjectOnCooldown(obj: any) {
        try {
            // 禁用物体
            obj.setData('active', false);
            
            // 更新视觉效果
            const graphic = obj.getData('graphic');
            const pulseGraphic = obj.getData('pulseGraphic');
            const type = obj.getData('type');
            
            // 保存原始颜色用于恢复
            if (graphic && !obj.getData('originalFillStyle')) {
                obj.setData('originalFillStyle', graphic.fillStyle);
            }
            
            if (graphic) {
                graphic.clear();
                graphic.fillStyle(0x333333, 0.6); // 灰色表示冷却
                
                // 保留原始形状但改变颜色
                if (type === 'powerCore') {
                    graphic.fillCircle(0, 0, 20);
                    // 添加放射状线条表示冷却
                    graphic.lineStyle(1, 0x555555, 0.8);
                    for (let i = 0; i < 8; i++) {
                        const angle = (i * Math.PI) / 4;
                        const x1 = Math.cos(angle) * 10;
                        const y1 = Math.sin(angle) * 10;
                        const x2 = Math.cos(angle) * 20;
                        const y2 = Math.sin(angle) * 20;
                        graphic.lineBetween(x1, y1, x2, y2);
                    }
                } else {
                    graphic.fillRect(-20, -20, 40, 40);
                    
                    // 为不同类型添加特定的冷却视觉效果
                    switch (type) {
                        case 'dataDrive':
                            // 添加对角线
                            graphic.lineStyle(2, 0x555555, 0.8);
                            graphic.lineBetween(-15, -15, 15, 15);
                            graphic.lineBetween(15, -15, -15, 15);
                            break;
                        case 'medStation':
                            // 添加灰色十字
                            graphic.lineStyle(3, 0x555555, 0.8);
                            graphic.lineBetween(-10, 0, 10, 0);
                            graphic.lineBetween(0, -10, 0, 10);
                            break;
                        case 'armory':
                            // 添加锁图标
                            graphic.lineStyle(2, 0x555555, 1);
                            graphic.strokeCircle(0, 0, 8);
                            graphic.fillRect(-5, 0, 10, 5);
                            break;
                        default: // terminal
                            // 添加一条横线
                            graphic.lineStyle(3, 0x555555, 0.8);
                            graphic.lineBetween(-15, 0, 15, 0);
                            break;
                    }
                }
            }
            
            if (pulseGraphic) {
                pulseGraphic.setAlpha(0.1);
            }
            
            // 创建冷却进度条
            this.createCooldownProgress(obj, 8000);
            
            // 8秒后恢复
            setTimeout(() => {
                this.restoreObjectAfterCooldown(obj, graphic, pulseGraphic, type);
            }, 8000);
        } catch (error) {
            console.error('Error during cooldown setup:', error);
        }
    }
    
    /**
     * 创建冷却进度条
     */
    private createCooldownProgress(obj: any, duration: number) {
        const progressBar = this.add.graphics();
        const type = obj.getData('type');
        let width = 40;
        let height = 5;
        let x = -20;
        let y = 25;
        
        // 根据不同类型调整进度条位置
        if (type === 'powerCore') {
            y = 30;
        }
        
        obj.setData('cooldownProgress', progressBar);
        
        // 初始背景
        progressBar.fillStyle(0x000000, 0.5);
        progressBar.fillRect(x, y, width, height);
        
        // 创建倒计时文本
        const countdownText = this.add.text(0, 32, '8s', {
            fontSize: '10px',
            color: '#FFFFFF',
            fontFamily: 'Arial',
            // fontWeight: 'bold'
        });
        countdownText.setOrigin(0.5);
        obj.setData('countdownText', countdownText);
        
        // 动态更新进度条和倒计时
        let remainingTime = duration / 1000;
        const updateInterval = setInterval(() => {
            remainingTime -= 1;
            
            if (remainingTime <= 0) {
                clearInterval(updateInterval);
                if (countdownText) countdownText.destroy();
                if (progressBar) progressBar.destroy();
                return;
            }
            
            // 更新倒计时文本
            if (countdownText) {
                countdownText.setText(`${Math.ceil(remainingTime)}s`);
            }
            
            // 更新进度条
            if (progressBar) {
                progressBar.clear();
                // 背景
                progressBar.fillStyle(0x000000, 0.5);
                progressBar.fillRect(x, y, width, height);
                
                // 进度
                const progressWidth = (remainingTime / (duration / 1000)) * width;
                progressBar.fillStyle(0x666666, 0.8);
                progressBar.fillRect(x, y, progressWidth, height);
            }
        }, 1000);
    }
    
    /**
     * 冷却结束后恢复物体状态
     */
    private restoreObjectAfterCooldown(obj: any, graphic: Phaser.GameObjects.Graphics, pulseGraphic: Phaser.GameObjects.Graphics, type: string) {
        try {
            obj.setData('active', true);
            
            // 移除进度条和倒计时
            const progressBar = obj.getData('cooldownProgress');
            const countdownText = obj.getData('countdownText');
            if (progressBar) progressBar.destroy();
            if (countdownText) countdownText.destroy();
            
            // 恢复原始外观
            if (graphic) {
                graphic.clear();
                
                // 颜色数据暂时未使用
                
                switch (type) {
                    case 'powerCore':
                        graphic.fillStyle(0xFF6600, 1);
                        graphic.fillCircle(0, 0, 20);
                        graphic.fillStyle(0xFFFF00, 0.4);
                        graphic.fillCircle(0, 0, 15);
                        break;
                    case 'dataDrive':
                        graphic.fillStyle(0x00CCFF, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(2, 0x00FFFF, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        break;
                    case 'medStation':
                        graphic.fillStyle(0xFF3366, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0xFF0000, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        break;
                    case 'armory':
                        graphic.fillStyle(0x6600FF, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0x9900FF, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        break;
                    default: // terminal
                        graphic.fillStyle(0x0099CC, 0.8);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0xFFFFFF, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        break;
                }
            }
            
            // 恢复脉冲效果
            if (pulseGraphic) {
                pulseGraphic.setAlpha(1);
            }
            
            // 添加恢复动画和特效（简化处理）
            
            // 显示"可用"提示
            const availableText = this.add.text(obj.x, obj.y - 30, '可用', {
                fontSize: '12px',
                color: '#00FF00',
                fontFamily: 'Arial',
                // fontWeight: 'bold'
            });
            availableText.setOrigin(0.5);
            
            // 淡入淡出动画
            this.tweens.add({
                targets: availableText,
                alpha: [0, 1, 0],
                y: [obj.y - 30, obj.y - 40, obj.y - 50],
                duration: 1000,
                onComplete: () => {
                    availableText.destroy();
                }
            });
        } catch (error) {
            console.error('Error during cooldown restoration:', error);
        }
    }
    
    // 显示全局通知
    private showNotification(message: string, color: string) {
        const notification = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 4,
            message,
            {
                fontSize: '20px',
                color: color,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 15, y: 10 },
                fontFamily: 'Arial',
                // fontWeight: 'bold'
            }
        );
        notification.setOrigin(0.5);
        notification.setDepth(200);
        
        // 添加粒子效果
        this.addParticles(notification.x, notification.y, parseInt(color.replace('#', '0x'), 16), 12, 1500);
        
        this.tweens.add({
            targets: notification,
            y: this.cameras.main.height / 5,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            onComplete: () => notification.destroy()
        });
    }
    
    // 添加通用粒子效果
    private addParticles(x: number, y: number, color: number, count: number, duration: number) {
        for (let i = 0; i < count; i++) {
            const particle = this.add.circle(x, y, 3, color, 0.8);
            particle.setDepth(201);
            
            const angle = (Math.PI * 2 / count) * i;
            // 粒子速度已在emitter配置中设置
            
            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * 50,
                y: y + Math.sin(angle) * 50,
                alpha: { from: 0.8, to: 0 },
                scale: { from: 1, to: 0.5 },
                duration: duration,
                ease: 'Cubic.easeInOut',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    // 更新可破坏物体
    private updateDestructibleObjects() {
        try {
            // 更新健康状态显示
            this.destructibleObjects.getChildren().forEach((obj: any) => {
                const health = obj.getData('health');
                const maxHealth = obj.getData('maxHealth');
                const graphic = obj.getData('graphic');
                
                if (health <= 0) {
                    // 创建爆炸效果
                    this.createDestructionEffect(obj.x, obj.y);
                    
                    // 移除物体
                    if (graphic) graphic.destroy();
                    obj.destroy();
                    
                    // 可能掉落物品
                    if (Math.random() > 0.5) {
                        this.dropItem(obj.x, obj.y);
                    }
                    
                    return;
                }
                
                // 根据健康状态改变颜色
                const healthPercent = health / maxHealth;
                let color = 0x8B4513;
                
                if (healthPercent < 0.3) {
                    color = 0xFF6666;
                } else if (healthPercent < 0.6) {
                    color = 0xFFAA00;
                }
                
                // 更新图形
                if (graphic) {
                    graphic.clear();
                    graphic.fillStyle(color, 1);
                    graphic.fillRect(-25, -25, 50, 50);
                    graphic.lineStyle(2, 0x666666, 1);
                    graphic.strokeRect(-25, -25, 50, 50);
                    
                    if (obj.getData('type') === 'crate') {
                        graphic.lineStyle(1, 0x444444, 0.8);
                        graphic.strokeRect(-20, -20, 40, 40);
                        graphic.fillStyle(0x666666, 1);
                        graphic.fillRect(-15, -5, 30, 10);
                    }
                }
            });
        } catch (error) {
            console.error('更新可破坏物体时出错:', error);
        }
    }
    
    // 创建破坏效果
    private createDestructionEffect(x: number, y: number) {
        try {
            // 创建爆炸粒子
            for (let i = 0; i < 8; i++) {
                const particle = this.add.graphics();
                const size = Phaser.Math.Between(5, 15);
                particle.fillStyle(0xFF6600, 1);
                particle.fillCircle(0, 0, size);
                particle.setPosition(x, y);
                
                const angle = (i / 8) * Math.PI * 2;
                
                this.tweens.add({
                    targets: particle,
                    x: x + Math.cos(angle) * 100,
                    y: y + Math.sin(angle) * 100,
                    scale: { from: 1, to: 0 },
                    alpha: { from: 1, to: 0 },
                    duration: 500 + Phaser.Math.Between(0, 300),
                    onComplete: () => particle.destroy()
                });
            }
        } catch (error) {
            console.error('创建破坏效果时出错:', error);
        }
    }
    
    // 掉落物品 - 使用精美的物品外观系统
    private dropItem(x: number, y: number) {
        try {
            // 随机选择掉落物品类型
            const itemTypes = [
                { type: 'medical', value: 20 },
                { type: 'ammo', subtype: 'rifle', value: 30 },
                { type: 'money', value: 50 },
                { type: 'armor', value: 40 }
            ];
            const selectedType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            
            // 使用已有的精美物品创建系统
            const itemDef: any = {
                x: x,
                y: y,
                type: selectedType.type,
                value: selectedType.value,
                name: this.getItemTypeName(selectedType.type)
            };
            
            if (selectedType.subtype) {
                itemDef.subtype = selectedType.subtype;
            }
            
            // 生成唯一索引
            const index = this.items.length;
            
            // 使用现有的createGameItem方法创建精美的物品
            const item = this.createGameItem(itemDef, index);
            
            if (item) {
                this.items.push(item);
                
                // 添加掉落动画效果
                if (item.body) {
                    // 随机初速度（向上弹跳）
                    const bounceAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 3;
                    const bounceForce = 150 + Math.random() * 100;
                    item.body.setVelocity(
                        Math.cos(bounceAngle) * bounceForce,
                        Math.sin(bounceAngle) * bounceForce
                    );
                    
                    // 添加旋转动画
                    if (item.graphic) {
                        this.tweens.add({
                            targets: item.graphic,
                            angle: 360,
                            duration: 2000,
                            repeat: -1,
                            ease: 'Linear'
                        });
                    }
                    
                    // 添加衰减的弹跳动画
                    this.tweens.add({
                        targets: item.body,
                        velocityX: 0,
                        velocityY: 0,
                        duration: 1500,
                        ease: 'Power2.easeOut'
                    });
                }
            }
        } catch (error) {
            console.error('掉落物品时出错:', error);
        }
    }
    
    // 更新门的状态
    private updateDoors() {
        try {
            this.doors.getChildren().forEach((door: any) => {
                if (door.getData('animating')) {
                    // 更新动画进度
                    let progress = door.getData('animationProgress');
                    const closed = door.getData('closed');
                    const speed = 0.02; // 动画速度
                    
                    progress += closed ? -speed : speed;
                    progress = Phaser.Math.Clamp(progress, 0, 1);
                    
                    door.setData('animationProgress', progress);
                    
                    // 更新门的外观
                    this.updateDoorVisual(door, progress);
                    
                    // 动画完成
                    if ((closed && progress <= 0) || (!closed && progress >= 1)) {
                        door.setData('animating', false);
                        door.body.enable = closed;
                    }
                }
                
                // 检测玩家接近并自动开门
                if (this.playerBody && !door.getData('animating')) {
                    const distance = Phaser.Math.Distance.Between(
                        this.playerBody.x, this.playerBody.y,
                        door.x, door.y
                    );
                    
                    if (distance < 100 && door.getData('closed')) {
                        this.toggleDoor(door);
                    } else if (distance > 200 && !door.getData('closed')) {
                        this.toggleDoor(door);
                    }
                }
            });
        } catch (error) {
            console.error('更新门状态时出错:', error);
        }
    }
    
    // 切换门的开关状态
    private toggleDoor(door: any) {
        try {
            if (door.getData('animating')) return;
            
            door.setData('closed', !door.getData('closed'));
            door.setData('animating', true);
            
            // 添加门开关的动画效果
            const graphic = door.getData('graphic');
            if (graphic) {
                this.tweens.add({
                    targets: graphic,
                    scale: { from: 1, to: 1.05, yoyo: true },
                    duration: 200
                });
            }
        } catch (error) {
            console.error('切换门状态时出错:', error);
        }
    }
    
    // 更新门的视觉效果
    private updateDoorVisual(door: any, progress: number) {
        try {
            const graphic = door.getData('graphic');
            const width = door.body.width;
            const height = door.body.height;
            const horizontal = door.getData('horizontal');
            
            if (!graphic) return;
            
            // 清空并重绘门
            graphic.clear();
            
            // 根据动画进度计算门的尺寸
            let currentWidth = width;
            let currentHeight = height;
            
            if (horizontal) {
                currentWidth = width * progress;
            } else {
                currentHeight = height * progress;
            }
            
            // 绘制门
            graphic.fillStyle(0x555555, 1);
            graphic.fillRect(-currentWidth/2, -currentHeight/2, currentWidth, currentHeight);
            
            // 只在门打开一定程度时绘制门把手
            if (progress > 0.3) {
                graphic.fillStyle(0xAA6622, 1);
                if (horizontal) {
                    const offset = Math.min(10, currentWidth * 0.25);
                    graphic.fillCircle(-offset, 0, 5);
                    graphic.fillCircle(offset, 0, 5);
                } else {
                    graphic.fillCircle(0, -currentHeight * 0.25, 5);
                }
            }
        } catch (error) {
            console.error('更新门视觉效果时出错:', error);
        }
    }
    
    // 更新动画效果
    private updateAnimations() {
        try {
            // 更新交互物体的脉冲动画
            this.interactiveObjects.getChildren().forEach((obj: any) => {
                if (obj.getData('active') && !obj.getData('animating')) {
                    obj.setData('animating', true);
                    
                    this.tweens.add({
                        targets: obj.getData('graphic'),
                        scale: { from: 1, to: 1.1, yoyo: true },
                        duration: 1000,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            });
            
            // 更新玩家移动时的地面效果
            if (this.playerBody && this.playerBody.body && (this.playerBody.body.velocity?.x !== 0 || this.playerBody.body.velocity?.y !== 0)) {
                // 随机创建脚步效果
                if (Math.random() < 0.1) {
                    const step = this.add.graphics();
                    step.fillStyle(0xFFFFFF, 0.5);
                    step.fillCircle(0, 0, 5);
                    step.setPosition(this.playerBody.x, this.playerBody.y);
                    step.setDepth(10);
                    
                    this.tweens.add({
                        targets: step,
                        scale: { from: 1, to: 2 },
                        alpha: { from: 0.5, to: 0 },
                        duration: 300,
                        onComplete: () => step.destroy()
                    });
                }
            }
        } catch (error) {
            console.error('更新动画效果时出错:', error);
        }
    }
    
    // 添加游戏物品 - 改进的物品系统
    private addGameItems() {
        try {
            const gridSize = 80;
            
            // 房间定义（网格坐标）
            const rooms = {
                start: { x: 10, y: 10, width: 10, height: 8 },
                left: { x: 10, y: 22, width: 8, height: 6 },
                main: { x: 24, y: 10, width: 12, height: 10 },
                right: { x: 40, y: 10, width: 8, height: 8 },
                treasure: { x: 24, y: 24, width: 10, height: 8 }
            };
            
            // 辅助函数：将房间内的相对坐标转换为世界坐标
            const getRoomPos = (room: string, offsetX: number, offsetY: number) => {
                const roomDef = rooms[room as keyof typeof rooms];
                if (!roomDef) return { x: offsetX * gridSize, y: offsetY * gridSize };
                return {
                    x: (roomDef.x + offsetX) * gridSize,
                    y: (roomDef.y + offsetY) * gridSize
                };
            };
            
            // 按房间分布的物品定义（使用房间内相对坐标，然后转换为世界坐标）
            const roomItems = [
                // 起始房间物品（房间内相对位置）
                { ...getRoomPos('start', 3, 2), type: 'money' as const, value: 200, room: 'start' },
                { ...getRoomPos('start', 2, 3), type: 'armor' as const, value: 25, room: 'start', name: '轻型护甲' },
                { ...getRoomPos('start', 4, 1.5), type: 'weapon' as const, value: 1, room: 'start', name: '手枪', subtype: 'pistol' },
                { ...getRoomPos('start', 1.5, 1.5), type: 'ammo' as const, value: 15, room: 'start', name: '手枪弹药', subtype: 'pistol' },
                
                // 左侧房间物品
                { ...getRoomPos('left', 2, 3), type: 'medical' as const, value: 30, room: 'left', name: '医疗包' },
                { ...getRoomPos('left', 2.5, 2.5), type: 'money' as const, value: 350, room: 'left' },
                { ...getRoomPos('left', 1.5, 4), type: 'ammo' as const, value: 20, room: 'left', name: '步枪弹药', subtype: 'rifle' },
                { ...getRoomPos('left', 1, 2.5), type: 'weapon' as const, value: 2, room: 'left', name: '步枪', subtype: 'rifle' },
                
                // 中央大厅物品
                { ...getRoomPos('main', 6, 1.5), type: 'money' as const, value: 500, room: 'main' },
                { ...getRoomPos('main', 5.5, 3), type: 'armor' as const, value: 40, room: 'main', name: '重型护甲' },
                { ...getRoomPos('main', 6.5, 4), type: 'medical' as const, value: 25, room: 'main', name: '绷带' },
                { ...getRoomPos('main', 7, 2), type: 'ammo' as const, value: 10, room: 'main', name: '霰弹枪弹药', subtype: 'shotgun' },
                { ...getRoomPos('main', 4.5, 2), type: 'ammo' as const, value: 5, room: 'main', name: '手枪弹药', subtype: 'pistol' },
                
                // 右侧房间物品
                { ...getRoomPos('right', 4, 1.5), type: 'weapon' as const, value: 3, room: 'right', name: '霰弹枪', subtype: 'shotgun' },
                { ...getRoomPos('right', 3.5, 2), type: 'ammo' as const, value: 30, room: 'right', name: '手枪弹药箱', subtype: 'pistol' },
                { ...getRoomPos('right', 4.5, 1), type: 'ammo' as const, value: 15, room: 'right', name: '步枪弹药', subtype: 'rifle' },
                
                // 宝藏房间物品（稀有和高价值）
                { ...getRoomPos('treasure', 5, 5.5), type: 'artifact' as const, value: 2000, room: 'treasure', name: '古代遗物' },
                { ...getRoomPos('treasure', 4.5, 5), type: 'money' as const, value: 1000, room: 'treasure' },
                { ...getRoomPos('treasure', 5.5, 5), type: 'money' as const, value: 1000, room: 'treasure' },
                { ...getRoomPos('treasure', 4.5, 6), type: 'medical' as const, value: 50, room: 'treasure', name: '超级医疗包' },
                { ...getRoomPos('treasure', 5.5, 6), type: 'armor' as const, value: 75, room: 'treasure', name: '终极护甲' },
                { ...getRoomPos('treasure', 5, 4.5), type: 'weapon' as const, value: 4, room: 'treasure', name: '狙击枪', subtype: 'sniper' },
                { ...getRoomPos('treasure', 4.5, 5.5), type: 'ammo' as const, value: 10, room: 'treasure', name: '狙击枪弹药', subtype: 'sniper' },
                { ...getRoomPos('treasure', 5.5, 5.5), type: 'ammo' as const, value: 20, room: 'treasure', name: '霰弹枪弹药箱', subtype: 'shotgun' },
                
                // 走廊中的零散物品（使用绝对网格坐标）
                { x: 20 * gridSize + 40, y: 12 * gridSize, type: 'money' as const, value: 150, room: 'corridor' },
                { x: 28 * gridSize, y: 20 * gridSize, type: 'medical' as const, value: 20, room: 'corridor', name: '止痛药' },
                { x: 36 * gridSize + 40, y: 12 * gridSize + 40, type: 'money' as const, value: 400, room: 'corridor' },
                { x: 24 * gridSize, y: 20 * gridSize, type: 'ammo' as const, value: 3, room: 'corridor', name: '狙击枪弹药', subtype: 'sniper' },
                { x: 30 * gridSize, y: 20 * gridSize, type: 'ammo' as const, value: 15, room: 'corridor', name: '步枪弹药', subtype: 'rifle' },
                
                // 资源类物品
                { ...getRoomPos('main', 3.5, 3), type: 'resource' as const, value: 50, room: 'main', name: '金属碎片', subtype: 'metal' },
                { ...getRoomPos('main', 7.5, 4), type: 'resource' as const, value: 30, room: 'main', name: '布料', subtype: 'fabric' },
                { ...getRoomPos('right', 4, 5), type: 'resource' as const, value: 80, room: 'right', name: '电子元件', subtype: 'electronics' },
                { ...getRoomPos('treasure', 4, 5.5), type: 'resource' as const, value: 60, room: 'treasure', name: '稀有金属', subtype: 'metal' },
                { ...getRoomPos('left', 3, 4), type: 'resource' as const, value: 40, room: 'left', name: '高级布料', subtype: 'fabric' }
            ];
            
            roomItems.forEach((def, index) => {
                const item = this.createGameItem(def, index);
                if (item) {
                    this.items.push(item);
                }
            });
            
            console.log(`添加了 ${this.items.length} 个游戏物品`);
            
        } catch (error) {
            console.error('添加游戏物品时出错:', error);
        }
    }
    
    // 创建单个游戏物品
    private createGameItem(def: any, index: number): GameItem | null {
        try {
            const graphic = this.add.graphics();
            let glowGraphic: Phaser.GameObjects.Graphics | null = null;
            
            // 根据物品类型设置不同的颜色、形状和特效
            switch (def.type) {
                case 'money':
                    // 金币 - 更精美的设计
                    // 外圈金色
                    graphic.fillStyle(0xffd700, 1);
                    graphic.fillCircle(0, 0, 12);
                    graphic.lineStyle(2, 0xffa500, 1);
                    graphic.strokeCircle(0, 0, 12);
                    // 内圈高光
                    graphic.fillStyle(0xffffaa, 1);
                    graphic.fillCircle(-3, -3, 5);
                    // $符号（简化版）
                    graphic.lineStyle(2, 0xffffff, 1);
                    graphic.beginPath();
                    graphic.moveTo(-2, -6);
                    graphic.lineTo(-2, 6);
                    // S形的上半部分
                    graphic.moveTo(-2, -4);
                    graphic.lineTo(0, -4);
                    graphic.lineTo(0, -2);
                    graphic.lineTo(2, -2);
                    // S形的下半部分
                    graphic.moveTo(0, 2);
                    graphic.lineTo(-2, 2);
                    graphic.lineTo(-2, 4);
                    graphic.lineTo(2, 4);
                    graphic.strokePath();
                    
                    // 添加光芒效果
                    glowGraphic = this.createGlowEffect(0xffd700, def.x, def.y, 25);
                    
                    // 添加旋转动画
                    this.addItemAnimation(graphic, 'rotate', def.x, def.y);
                    break;
                    
                case 'medical':
                    // 医疗物品 - 更精美的医疗包设计
                    // 医疗包主体
                    graphic.fillStyle(0x2ecc71, 1);
                    graphic.fillRoundedRect(-10, -8, 20, 16, 3);
                    graphic.lineStyle(2, 0x27ae60, 1);
                    graphic.strokeRoundedRect(-10, -8, 20, 16, 3);
                    // 红色十字
                    graphic.fillStyle(0xe74c3c, 1);
                    graphic.fillRect(-6, -2, 12, 4);
                    graphic.fillRect(-2, -6, 4, 12);
                    // 白色十字边框
                    graphic.lineStyle(1, 0xffffff, 1);
                    graphic.strokeRect(-6, -2, 12, 4);
                    graphic.strokeRect(-2, -6, 4, 12);
                    // 顶部小提手（简化版）
                    graphic.lineStyle(2, 0x34495e, 1);
                    graphic.beginPath();
                    graphic.moveTo(-4, -8);
                    graphic.lineTo(0, -11);
                    graphic.lineTo(4, -8);
                    graphic.strokePath();
                    
                    // 添加脉动效果
                    this.addItemAnimation(graphic, 'pulse', def.x, def.y);
                    glowGraphic = this.createGlowEffect(0x2ecc71, def.x, def.y, 20);
                    break;
                    
                case 'armor':
                    // 护甲 - 精美的盾牌设计
                    // 盾牌外圈
                    graphic.fillStyle(0x3498db, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -10);
                    graphic.lineTo(-8, -5);
                    graphic.lineTo(-9, 2);
                    graphic.lineTo(-6, 8);
                    graphic.lineTo(6, 8);
                    graphic.lineTo(9, 2);
                    graphic.lineTo(8, -5);
                    graphic.closePath();
                    graphic.fill();
                    // 内圈高光
                    graphic.fillStyle(0x5dade2, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -8);
                    graphic.lineTo(-5, -3);
                    graphic.lineTo(-6, 3);
                    graphic.lineTo(-4, 6);
                    graphic.lineTo(4, 6);
                    graphic.lineTo(6, 3);
                    graphic.lineTo(5, -3);
                    graphic.closePath();
                    graphic.fill();
                    // 盾牌中心装饰
                    graphic.fillStyle(0x1b4f72, 1);
                    graphic.fillCircle(0, 0, 4);
                    graphic.lineStyle(2, 0x85c1e9, 1);
                    graphic.strokeCircle(0, 0, 4);
                    // 外边框
                    graphic.lineStyle(2, 0x1b4f72, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -10);
                    graphic.lineTo(-8, -5);
                    graphic.lineTo(-9, 2);
                    graphic.lineTo(-6, 8);
                    graphic.lineTo(6, 8);
                    graphic.lineTo(9, 2);
                    graphic.lineTo(8, -5);
                    graphic.closePath();
                    graphic.strokePath();
                    
                    // 添加轻微摇摆
                    this.addItemAnimation(graphic, 'sway', def.x, def.y);
                    glowGraphic = this.createGlowEffect(0x3498db, def.x, def.y, 22);
                    break;
                    
                case 'artifact':
                    // 遗物 - 更神秘的宝石设计
                    // 外圈紫色
                    graphic.fillStyle(0x8e44ad, 1);
                    graphic.fillCircle(0, 0, 14);
                    // 内圈渐变
                    graphic.fillStyle(0xbb8fce, 1);
                    graphic.fillCircle(0, 0, 10);
                    // 核心发光
                    graphic.fillStyle(0xf4d03f, 1);
                    graphic.fillCircle(0, 0, 6);
                    // 装饰星星
                    this.drawStar(graphic, 0, 0, 5, 8);
                    graphic.fillStyle(0xffffff, 0.8);
                    graphic.fillPath();
                    // 外边框
                    graphic.lineStyle(2, 0x6c3483, 1);
                    graphic.strokeCircle(0, 0, 14);
                    graphic.lineStyle(1, 0xf4d03f, 0.6);
                    graphic.strokeCircle(0, 0, 10);
                    
                    // 强烈的发光效果
                    glowGraphic = this.createGlowEffect(0x8e44ad, def.x, def.y, 35);
                    
                    // 复杂动画
                    this.addItemAnimation(graphic, 'float', def.x, def.y);
                    break;
                    
                case 'weapon':
                    // 根据武器子类型设置不同的颜色和形状 - 更精美的设计
                    let weaponColor = 0xff8c00; // 默认橙色
                    switch (def.subtype) {
                        case 'rifle':
                            weaponColor = 0x2ecc71; // 步枪 - 绿色
                            // 步枪形状 - 更精细
                            // 枪管
                            graphic.fillStyle(0x27ae60, 1);
                            graphic.fillRect(-12, -3, 22, 6);
                            graphic.lineStyle(1, 0x1e8449, 1);
                            graphic.strokeRect(-12, -3, 22, 6);
                            // 枪托
                            graphic.fillStyle(0x229954, 1);
                            graphic.fillRect(-12, -5, 6, 10);
                            graphic.fillRect(-10, -6, 4, 12);
                            // 瞄准镜
                            graphic.fillStyle(0x1e8449, 1);
                            graphic.fillRect(8, -5, 4, 10);
                            graphic.fillCircle(10, 0, 3);
                            graphic.fillStyle(0xffffff, 0.5);
                            graphic.fillCircle(10, 0, 1);
                            // 枪口
                            graphic.fillStyle(0x1a1a1a, 1);
                            graphic.fillRect(10, -2, 2, 4);
                            break;
                            
                        case 'shotgun':
                            weaponColor = 0xe67e22; // 霰弹枪 - 橙黄色
                            // 霰弹枪形状 - 双管设计
                            // 主体
                            graphic.fillStyle(0xd35400, 1);
                            graphic.fillRoundedRect(-10, -6, 18, 12, 2);
                            // 双管
                            graphic.fillStyle(0x1a1a1a, 1);
                            graphic.fillRect(8, -4, 3, 3);
                            graphic.fillRect(8, 1, 3, 3);
                            // 枪托
                            graphic.fillStyle(0xba4a00, 1);
                            graphic.fillRect(-12, -4, 6, 8);
                            graphic.fillRect(-10, -5, 4, 10);
                            // 装饰条纹
                            graphic.lineStyle(1, 0xe67e22, 0.8);
                            graphic.strokeRect(-8, -4, 16, 8);
                            break;
                            
                        case 'sniper':
                            weaponColor = 0x3498db; // 狙击枪 - 蓝色
                            // 狙击枪形状 - 带瞄准镜的长枪
                            // 枪管
                            graphic.fillStyle(0x2874a6, 1);
                            graphic.fillRect(-16, -2, 30, 4);
                            graphic.lineStyle(1, 0x1b4f72, 1);
                            graphic.strokeRect(-16, -2, 30, 4);
                            // 瞄准镜
                            graphic.fillStyle(0x1b4f72, 1);
                            graphic.fillRect(-10, -6, 8, 12);
                            graphic.fillStyle(0x000000, 1);
                            graphic.fillCircle(-6, 0, 4);
                            graphic.fillStyle(0x00ff00, 0.3);
                            graphic.fillCircle(-6, 0, 3);
                            // 枪托
                            graphic.fillStyle(0x2874a6, 1);
                            graphic.fillRect(-16, -4, 6, 8);
                            // 枪口
                            graphic.fillStyle(0x1a1a1a, 1);
                            graphic.fillRect(14, -1, 2, 2);
                            break;
                            
                        default:
                            // 默认手枪形状 - 更精美
                            weaponColor = 0xff8c00;
                            // 枪身
                            graphic.fillStyle(0xe67e22, 1);
                            graphic.fillRoundedRect(-8, -4, 14, 8, 2);
                            // 枪管
                            graphic.fillStyle(0x1a1a1a, 1);
                            graphic.fillRect(6, -2, 4, 4);
                            // 握把
                            graphic.fillStyle(0x8b4513, 1);
                            graphic.fillRect(-8, 2, 6, 4);
                            graphic.lineStyle(1, 0x654321, 1);
                            graphic.strokeRect(-8, 2, 6, 4);
                            // 扳机
                            graphic.fillStyle(0x1a1a1a, 1);
                            graphic.fillRect(-2, 4, 2, 3);
                            break;
                    }
                    
                    // 添加相应颜色的发光效果
                    glowGraphic = this.createGlowEffect(weaponColor, def.x, def.y, 22);
                    
                    // 添加轻微旋转
                    this.addItemAnimation(graphic, 'rotate', def.x, def.y, 5000);
                    break;
                    
                case 'ammo':
                    // 根据弹药类型设置不同的颜色和形状 - 更精美的弹药设计
                    let ammoColor = 0x2ecc71; // 默认绿色
                    let ammoCount = def.quantity || 1;
                    
                    switch (def.subtype) {
                        case 'rifle':
                            ammoColor = 0x2ecc71; // 步枪弹药 - 绿色
                            break;
                            
                        case 'shotgun':
                            ammoColor = 0xe67e22; // 霰弹弹药 - 橙黄色
                            break;
                            
                        case 'sniper':
                            ammoColor = 0x3498db; // 狙击弹药 - 蓝色
                            break;
                            
                        default:
                            ammoColor = 0x2ecc71; // 默认绿色
                            break;
                    }
                    
                    // 弹药形状 - 更真实的子弹设计
                    // 弹壳
                    graphic.fillStyle(0xd5a674, 1); // 黄铜色
                    graphic.fillRect(-7, -3, 10, 6);
                    graphic.lineStyle(1, 0xb8860b, 1);
                    graphic.strokeRect(-7, -3, 10, 6);
                    // 弹头
                    const darkerAmmo = Phaser.Display.Color.ValueToColor(ammoColor).darken(30).color;
                    graphic.fillStyle(darkerAmmo, 1);
                    graphic.beginPath();
                    graphic.moveTo(3, -3);
                    graphic.lineTo(7, 0);
                    graphic.lineTo(3, 3);
                    graphic.closePath();
                    graphic.fill();
                    // 弹头高光
                    graphic.fillStyle(ammoColor, 1);
                    graphic.fillRect(3, -2, 3, 4);
                    // 弹壳装饰
                    graphic.lineStyle(1, 0x8b6914, 0.6);
                    graphic.strokeRect(-6, -2, 8, 4);
                    
                    // 显示弹药数量徽章
                    if (ammoCount > 1) {
                        const badge = this.add.graphics();
                        badge.fillStyle(0x2c3e50, 0.9);
                        badge.fillCircle(0, -12, 8);
                        badge.lineStyle(1, 0xffffff, 1);
                        badge.strokeCircle(0, -12, 8);
                        badge.setPosition(def.x, def.y);
                        badge.setDepth(61);
                        
                        const countText = this.add.text(def.x, def.y - 12, `${ammoCount}`, {
                            fontSize: '10px',
                            color: '#ffffff',
                            fontStyle: 'bold',
                            stroke: '#000000',
                            strokeThickness: 1
                        });
                        countText.setOrigin(0.5);
                        countText.setDepth(62);
                        // 将文字对象保存到物品中以便后续清理
                        (def as any).extraGraphic = [badge, countText];
                    }
                    
                    // 添加脉动效果
                    this.addItemAnimation(graphic, 'pulse', def.x, def.y);
                    glowGraphic = this.createGlowEffect(ammoColor, def.x, def.y, 18);
                    break;
                    
                case 'resource':
                    // 资源类物品 - 更精美的设计
                    let resourceColor = 0x95a5a6; // 默认灰色
                    let resourceShape = 'square';
                    
                    // 根据子类型设置不同的外观
                    if (def.subtype === 'metal') {
                        resourceColor = 0xbdc3c7; // 金属 - 银灰色
                        resourceShape = 'hexagon';
                    } else if (def.subtype === 'fabric') {
                        resourceColor = 0xf8c471; // 布料 - 米黄色
                        resourceShape = 'circle';
                    } else if (def.subtype === 'electronics') {
                        resourceColor = 0x3498db; // 电子元件 - 蓝色
                        resourceShape = 'square';
                    }
                    
                    // 根据形状绘制
                    if (resourceShape === 'hexagon') {
                        // 六边形金属
                        graphic.fillStyle(resourceColor, 1);
                        graphic.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI / 3) * i;
                            const x = Math.cos(angle) * 8;
                            const y = Math.sin(angle) * 8;
                            if (i === 0) graphic.moveTo(x, y);
                            else graphic.lineTo(x, y);
                        }
                        graphic.closePath();
                        graphic.fill();
                        graphic.lineStyle(2, 0x7f8c8d, 1);
                        graphic.strokePath();
                        // 内部高光
                        graphic.fillStyle(0xecf0f1, 0.6);
                        graphic.fillCircle(-2, -2, 3);
                    } else if (resourceShape === 'circle') {
                        // 圆形布料
                        graphic.fillStyle(resourceColor, 1);
                        graphic.fillCircle(0, 0, 9);
                        graphic.lineStyle(2, 0xe67e22, 1);
                        graphic.strokeCircle(0, 0, 9);
                        // 纹理效果
                        graphic.lineStyle(1, 0xd4ac0d, 0.5);
                        for (let i = 0; i < 3; i++) {
                            const angle = (Math.PI * 2 / 3) * i;
                            graphic.beginPath();
                            graphic.moveTo(0, 0);
                            graphic.lineTo(Math.cos(angle) * 9, Math.sin(angle) * 9);
                            graphic.strokePath();
                        }
                    } else {
                        // 方形电子元件
                        graphic.fillStyle(resourceColor, 1);
                        graphic.fillRoundedRect(-7, -7, 14, 14, 2);
                        graphic.lineStyle(2, 0x2874a6, 1);
                        graphic.strokeRoundedRect(-7, -7, 14, 14, 2);
                        // 电路板效果
                        graphic.lineStyle(1, 0x1b4f72, 0.8);
                        graphic.strokeRect(-5, -5, 10, 10);
                        graphic.beginPath();
                        graphic.moveTo(-3, -5);
                        graphic.lineTo(-3, 5);
                        graphic.moveTo(3, -5);
                        graphic.lineTo(3, 5);
                        graphic.moveTo(-5, -3);
                        graphic.lineTo(5, -3);
                        graphic.moveTo(-5, 3);
                        graphic.lineTo(5, 3);
                        graphic.strokePath();
                        // 发光点
                        graphic.fillStyle(0x00ffff, 0.8);
                        graphic.fillCircle(-3, -3, 1);
                        graphic.fillCircle(3, 3, 1);
                    }
                    
                    // 添加轻微闪烁效果
                    this.addItemAnimation(graphic, 'pulse', def.x, def.y, 2000);
                    glowGraphic = this.createGlowEffect(resourceColor, def.x, def.y, 15);
                    break;
            }
            
            graphic.setPosition(def.x, def.y);
            graphic.setDepth(60);
            
            // 创建物理碰撞体
            const body = this.physics.add.sprite(def.x, def.y, '');
            body.setCircle(15); // 更大的收集范围
            body.setDepth(60);
            body.setImmovable(true);
            
            // 根据物品类型设置属性
            let weight = 0;
            let rarity = ItemRarity.COMMON;
            let durability: number | undefined = undefined;
            let maxDurability: number | undefined = undefined;
            
            switch (def.type) {
                case 'weapon':
                    weight = 5; // 武器较重
                    rarity = def.value === 4 ? ItemRarity.EPIC : (def.value === 3 ? ItemRarity.RARE : ItemRarity.UNCOMMON);
                    durability = 100;
                    maxDurability = 100;
                    break;
                case 'armor':
                    weight = 8; // 护甲最重
                    rarity = def.value >= 75 ? ItemRarity.EPIC : (def.value >= 40 ? ItemRarity.RARE : ItemRarity.UNCOMMON);
                    durability = 100;
                    maxDurability = 100;
                    break;
                case 'ammo':
                    weight = 0.5; // 弹药较轻
                    rarity = ItemRarity.COMMON;
                    break;
                case 'medical':
                    weight = 2; // 医疗物品中等重量
                    rarity = def.value >= 50 ? ItemRarity.RARE : ItemRarity.UNCOMMON;
                    break;
                case 'artifact':
                    weight = 3; // 工艺品中等重量
                    rarity = ItemRarity.LEGENDARY;
                    break;
                case 'money':
                    weight = 0.1; // 金钱很轻
                    rarity = def.value >= 1000 ? ItemRarity.RARE : ItemRarity.COMMON;
                    break;
                case 'resource':
                    weight = 1; // 资源类物品较轻
                    rarity = ItemRarity.COMMON;
                    break;
            }
            
            // 根据稀有度调整价值
            let finalValue = def.value || 0;
            switch (rarity) {
                case ItemRarity.UNCOMMON:
                    finalValue = Math.floor(finalValue * 1.2);
                    break;
                case ItemRarity.RARE:
                    finalValue = Math.floor(finalValue * 1.5);
                    break;
                case ItemRarity.EPIC:
                    finalValue = Math.floor(finalValue * 2);
                    break;
                case ItemRarity.LEGENDARY:
                    finalValue = Math.floor(finalValue * 3);
                    break;
            }
            
            // 创建物品对象
            const item: GameItem = {
                id: `item_${index}`,
                type: def.type,
                x: def.x,
                y: def.y,
                graphic,
                body,
                value: finalValue,
                name: def.name || this.getItemTypeName(def.type),
                quantity: def.quantity || 1,
                glowGraphic: glowGraphic,
                weight: weight,
                rarity: rarity,
                durability: durability,
                maxDurability: maxDurability
            };
            
            // 保存额外图形对象到物品中以便后续清理（如弹药数量徽章）
            if ((def as any).extraGraphic) {
                (item as any).extraGraphic = (def as any).extraGraphic;
            }
            
            return item;
            
        } catch (error) {
            console.error('创建物品时出错:', error);
            return null;
        }
    }
    
    // 创建物品发光效果
    private createGlowEffect(color: number, x: number, y: number, radius = 20): Phaser.GameObjects.Graphics {
        const glow = this.add.graphics();
        glow.fillStyle(color, 0.3);
        glow.fillCircle(0, 0, radius);
        glow.setPosition(x, y);
        glow.setDepth(59);
        
        // 呼吸效果
        this.tweens.add({
            targets: glow,
            alpha: [0.3, 0.6, 0.3],
            duration: 2000,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        return glow;
    }
    
    // 添加物品动画
    private addItemAnimation(graphic: Phaser.GameObjects.Graphics, type: string, _x: number, y: number, duration = 3000) {
        switch (type) {
            case 'rotate':
                this.tweens.add({
                    targets: graphic,
                    angle: 360,
                    duration: duration,
                    repeat: -1,
                    ease: 'Linear'
                });
                break;
                
            case 'pulse':
                this.tweens.add({
                    targets: graphic,
                    scale: [1, 1.2, 1],
                    duration: duration,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;
                
            case 'sway':
                this.tweens.add({
                    targets: graphic,
                    rotation: [0, 0.1, 0, -0.1, 0],
                    duration: duration,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;
                
            case 'float':
                this.tweens.add({
                    targets: graphic,
                    y: [y, y - 10, y],
                    duration: duration,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;
        }
    }
    
    // 获取物品类型的显示名称
    private getItemTypeName(type: string): string {
        const typeNames: Record<string, string> = {
            money: '💰 金币',
            medical: '💊 医疗用品',
            armor: '🛡️ 护甲',
            artifact: '🏺 遗物',
            weapon: '🔫 武器',
            ammo: '📦 弹药',
            resource: '⚙️ 资源'
        };
        return typeNames[type] || type;
    }
    
    // 添加敌人 - 改进的敌人系统
    private addEnemies() {
        try {
            const gridSize = 80;
            
            // 房间定义（网格坐标）
            const rooms = {
                left: { x: 10, y: 22, width: 8, height: 6 },
                main: { x: 24, y: 10, width: 12, height: 10 },
                right: { x: 40, y: 10, width: 8, height: 8 },
                treasure: { x: 24, y: 24, width: 10, height: 8 }
            };
            
            // 辅助函数：将房间内的相对坐标转换为世界坐标（避免墙壁）
            const getRoomPos = (room: string, offsetX: number, offsetY: number) => {
                const roomDef = rooms[room as keyof typeof rooms];
                if (!roomDef) return { x: offsetX * gridSize, y: offsetY * gridSize };
                // 确保敌人生成在房间内部，远离墙壁
                const safeMargin = 1.5; // 安全边距
                const clampedX = Math.max(safeMargin, Math.min(roomDef.width - safeMargin, offsetX));
                const clampedY = Math.max(safeMargin, Math.min(roomDef.height - safeMargin, offsetY));
                return {
                    x: (roomDef.x + clampedX) * gridSize,
                    y: (roomDef.y + clampedY) * gridSize
                };
            };
            
            // 根据房间分布的敌人位置和类型（调整后避免墙壁）
            const enemyDefinitions = [
                // 起始房间附近的敌人（较弱） - 走廊
                { x: 20 * gridSize + 40, y: 12 * gridSize, type: 'grunt', health: 50, damage: 10, speed: 100, room: 'corridor' },
                
                // 左侧房间的敌人
                { ...getRoomPos('left', 3, 3), type: 'grunt', health: 50, damage: 10, speed: 100, room: 'left' },
                { ...getRoomPos('left', 5, 4), type: 'grunt', health: 50, damage: 10, speed: 100, room: 'left' },
                
                // 中央大厅的敌人（中等强度）
                { ...getRoomPos('main', 6, 5), type: 'soldier', health: 80, damage: 15, speed: 120, room: 'main' },
                { ...getRoomPos('main', 8, 3), type: 'soldier', health: 80, damage: 15, speed: 120, room: 'main' },
                
                // 右侧房间的敌人
                { ...getRoomPos('right', 4, 4), type: 'grunt', health: 50, damage: 10, speed: 100, room: 'right' },
                { ...getRoomPos('right', 5, 3), type: 'soldier', health: 80, damage: 15, speed: 120, room: 'right' },
                
                // 宝藏房间附近的敌人（较强）
                { ...getRoomPos('treasure', 5, 4), type: 'captain', health: 120, damage: 20, speed: 90, room: 'treasure' },
                { ...getRoomPos('treasure', 4, 5), type: 'soldier', health: 80, damage: 15, speed: 120, room: 'treasure' },
                { ...getRoomPos('treasure', 6, 5), type: 'soldier', health: 80, damage: 15, speed: 120, room: 'treasure' },
                
                // 走廊中的巡逻敌人
                { x: 28 * gridSize, y: 20 * gridSize, type: 'grunt', health: 50, damage: 10, speed: 100, room: 'corridor' },
                { x: 36 * gridSize + 40, y: 12 * gridSize + 40, type: 'soldier', health: 80, damage: 15, speed: 120, room: 'corridor' }
            ];
            
            enemyDefinitions.forEach((def, index) => {
                const enemy = this.createEnemy(def, index);
                if (enemy) {
                    this.enemies.push(enemy);
                }
            });
            
            console.log(`添加了 ${this.enemies.length} 个敌人`);
            
        } catch (error) {
            console.error('添加敌人时出错:', error);
        }
    }
    
    // 创建单个敌人
    private createEnemy(def: any, index: number): any {
        try {
            const graphic = this.add.graphics();
            let eyeGraphic: Phaser.GameObjects.Graphics | null = null;
            
            // 根据敌人类型设置不同的外观 - 精美的机器人设计
            switch (def.type) {
                case 'grunt':
                    // 普通敌人 - 红色威胁机器人设计（更明显）
                    // 威胁外圈（红色警告环）
                    graphic.lineStyle(3, 0xff0000, 0.8);
                    graphic.strokeCircle(0, 0, 20);
                    
                    // 身体主体（更方更硬朗）
                    graphic.fillStyle(0xff4444, 1);
                    graphic.fillRect(-14, -10, 28, 20);
                    graphic.lineStyle(3, 0xcc0000, 1);
                    graphic.strokeRect(-14, -10, 28, 20);
                    
                    // 头部（更方更威胁）
                    graphic.fillStyle(0xff4444, 1);
                    graphic.fillRoundedRect(-12, -22, 24, 14, 2);
                    graphic.lineStyle(3, 0xcc0000, 1);
                    graphic.strokeRoundedRect(-12, -22, 24, 14, 2);
                    
                    // 头部顶部装饰（威胁标识）
                    graphic.fillStyle(0xcc0000, 1);
                    graphic.fillRect(-10, -24, 20, 3);
                    
                    // 身体高光（更暗，增强威胁感）
                    graphic.fillStyle(0xff6666, 1);
                    graphic.fillRect(-10, -8, 20, 10);
                    
                    // 身体装饰线条（警告条纹）
                    graphic.lineStyle(2, 0xcc0000, 1);
                    graphic.beginPath();
                    graphic.moveTo(-12, 0);
                    graphic.lineTo(12, 0);
                    graphic.strokePath();
                    
                    // 肩膀装甲（更突出）
                    graphic.fillStyle(0xcc0000, 1);
                    graphic.fillRect(-16, -8, 5, 10);
                    graphic.fillRect(11, -8, 5, 10);
                    graphic.lineStyle(2, 0x990000, 1);
                    graphic.strokeRect(-16, -8, 5, 10);
                    graphic.strokeRect(11, -8, 5, 10);
                    
                    // 腿部（更粗更稳定）
                    graphic.fillStyle(0xff4444, 1);
                    graphic.fillRect(-7, 10, 6, 10);
                    graphic.fillRect(1, 10, 6, 10);
                    graphic.lineStyle(2, 0xcc0000, 1);
                    graphic.strokeRect(-7, 10, 6, 10);
                    graphic.strokeRect(1, 10, 6, 10);
                    
                    // 外边框增强（更粗）
                    graphic.lineStyle(4, 0x990000, 1);
                    graphic.strokeRect(-14, -10, 28, 20);
                    
                    // 添加眼睛（红色威胁）
                    eyeGraphic = this.createEnemyEyes(def.x, def.y, 0xff0000);
                    break;
                    
                case 'soldier':
                    // 士兵 - 橙色六边形精英机器人设计（更威胁）
                    // 威胁外圈（橙色警告环）
                    graphic.lineStyle(3, 0xff7700, 0.8);
                    graphic.strokeCircle(0, 0, 22);
                    
                    // 六边形主体（更大）
                    graphic.fillStyle(0xff7700, 1);
                    this.drawHexagon(graphic, 0, 0, 18);
                    graphic.lineStyle(4, 0xcc5500, 1);
                    this.drawHexagon(graphic, 0, 0, 18);
                    
                    // 内层六边形（装甲层）
                    graphic.fillStyle(0xffaa33, 1);
                    this.drawHexagon(graphic, 0, 0, 14);
                    graphic.lineStyle(2, 0xcc6600, 1);
                    this.drawHexagon(graphic, 0, 0, 14);
                    
                    // 中心能量核心（更明显）
                    graphic.fillStyle(0xffffff, 1);
                    graphic.fillCircle(0, 0, 7);
                    graphic.fillStyle(0xff7700, 1);
                    graphic.fillCircle(0, 0, 5);
                    graphic.fillStyle(0xffcc66, 1);
                    graphic.fillCircle(0, 0, 3);
                    
                    // 装饰角（更突出，像武器）
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i;
                        const x = Math.cos(angle) * 16;
                        const y = Math.sin(angle) * 16;
                        graphic.fillStyle(0xcc5500, 1);
                        graphic.fillCircle(x, y, 4);
                        graphic.lineStyle(1, 0x993300, 1);
                        graphic.strokeCircle(x, y, 4);
                    }
                    
                    // 外边框（更粗）
                    graphic.lineStyle(3, 0xcc5500, 1);
                    this.drawHexagon(graphic, 0, 0, 18);
                    
                    // 添加眼睛（橙色威胁）
                    eyeGraphic = this.createEnemyEyes(def.x, def.y, 0xff8c00);
                    break;
                    
                case 'captain':
                    // 队长 - 紫色星形BOSS机器人（最强威胁）
                    // 多重威胁外圈（紫色能量环）
                    graphic.lineStyle(3, 0xff00ff, 0.6);
                    graphic.strokeCircle(0, 0, 28);
                    graphic.lineStyle(2, 0x9900ff, 0.8);
                    graphic.strokeCircle(0, 0, 24);
                    
                    // 星形主体（更大更威胁）
                    graphic.fillStyle(0x9900ff, 1);
                    this.drawStar(graphic, 0, 0, 22, 14);
                    graphic.lineStyle(4, 0x6600cc, 1);
                    this.drawStar(graphic, 0, 0, 22, 14);
                    
                    // 内层星形（装甲层）
                    graphic.fillStyle(0xbb66ff, 1);
                    this.drawStar(graphic, 0, 0, 18, 11);
                    graphic.lineStyle(2, 0x8800dd, 1);
                    this.drawStar(graphic, 0, 0, 18, 11);
                    
                    // 中心能量核心（最强能量）
                    graphic.fillStyle(0xffffff, 1);
                    graphic.fillCircle(0, 0, 9);
                    graphic.fillStyle(0x9900ff, 1);
                    graphic.fillCircle(0, 0, 7);
                    graphic.fillStyle(0xf4d03f, 1);
                    graphic.fillCircle(0, 0, 5);
                    graphic.fillStyle(0xffffff, 0.8);
                    graphic.fillCircle(0, 0, 3);
                    
                    // 星形装饰点（能量武器）
                    for (let i = 0; i < 10; i++) {
                        const angle = (Math.PI / 5) * i;
                        const x = Math.cos(angle) * 20;
                        const y = Math.sin(angle) * 20;
                        graphic.fillStyle(0xf4d03f, 1);
                        graphic.fillCircle(x, y, 3);
                        graphic.lineStyle(1, 0xffaa00, 1);
                        graphic.strokeCircle(x, y, 3);
                    }
                    
                    // 外边框增强（更粗更明显）
                    graphic.lineStyle(3, 0x6600cc, 1);
                    this.drawStar(graphic, 0, 0, 22, 14);
                    
                    // 添加眼睛和光环
                    eyeGraphic = this.createEnemyEyes(def.x, def.y, 0x9900ff);
                    this.createEnemyAura(def.x, def.y, 0x9900ff, 35);
                    break;
            }
            
            graphic.setPosition(def.x, def.y);
            graphic.setDepth(70);
            
            // 创建物理碰撞体
            const body = this.physics.add.sprite(def.x, def.y, '');
            body.setCircle(16);
            body.setDepth(70);
            body.setCollideWorldBounds(true);
            body.setVisible(false); // 隐藏物理碰撞体的方块显示
            
            // 配置物理属性（确保敌人可以移动）
            body.setMaxVelocity(def.speed * 2); // 增加最大速度限制
            body.setDrag(100); // 减少阻力，让移动更流畅
            body.setBounce(0); // 无反弹
            body.setImmovable(false); // 敌人可以移动
            body.setPushable(true); // 可以被推动
            body.setCollideWorldBounds(true); // 确保碰撞边界
            if (body.body) {
                (body.body as any).setAllowGravity(false); // 禁用重力（2D游戏）
                // 确保物理体是可移动的
                (body.body as any).setAllowRotation(false); // 禁用旋转
            }
            
            // 创建血量条背景（更精美）
            const healthBarBg = this.add.graphics();
            healthBarBg.fillStyle(0x000000, 0.9);
            healthBarBg.fillRoundedRect(-22, -32, 44, 6, 2);
            healthBarBg.lineStyle(1, 0x333333, 1);
            healthBarBg.strokeRoundedRect(-22, -32, 44, 6, 2);
            healthBarBg.setPosition(def.x, def.y);
            healthBarBg.setDepth(72);
            
            // 创建血量条（根据敌人类型使用不同颜色）
            const healthBar = this.add.graphics();
            let healthColor = 0xff0000; // 默认红色
            switch (def.type) {
                case 'grunt': healthColor = 0xff0000; break; // 红色
                case 'soldier': healthColor = 0xff7700; break; // 橙色
                case 'captain': healthColor = 0xff00ff; break; // 紫色
            }
            healthBar.fillStyle(healthColor, 1);
            healthBar.fillRoundedRect(-20, -30, 40, 4, 1);
            // 血量条高光
            healthBar.fillStyle(0xffffff, 0.3);
            healthBar.fillRoundedRect(-20, -30, 40, 2, 1);
            healthBar.setPosition(def.x, def.y);
            healthBar.setDepth(73);
            
            // 创建敌人类型标签（更明显的区分）
            const typeLabels: { [key: string]: string } = {
                'grunt': '普通',
                'soldier': '精英',
                'captain': 'BOSS'
            };
            const typeColors: { [key: string]: number } = {
                'grunt': 0xff0000,
                'soldier': 0xff7700,
                'captain': 0xff00ff
            };
            const typeLabel = this.add.text(def.x, def.y - 45, typeLabels[def.type] || '敌人', {
                font: 'bold 12px Arial',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                backgroundColor: `#${typeColors[def.type].toString(16).padStart(6, '0')}`,
                padding: { x: 4, y: 2 }
            });
            typeLabel.setOrigin(0.5);
            typeLabel.setDepth(74);
            
            // 创建敌人对象
            const enemy = {
                id: `enemy_${index}`,
                type: def.type,
                x: def.x,
                y: def.y,
                graphic,
                body,
                health: def.health,
                maxHealth: def.health,
                damage: def.damage,
                speed: def.speed,
                room: def.room,
                state: 'patrol',
                patrolPath: this.generatePatrolPath(def.room, def.x, def.y),
                patrolIndex: 0,
                lastPlayerSpotted: 0,
                eyeGraphic,
                healthBarBg,
                healthBar,
                typeLabel, // 添加类型标签
                isHit: false,
                hitTimer: 0,
                lastAttack: 0, // 初始化上次攻击时间
                stateVisualTween: null as Phaser.Tweens.Tween | null // 状态视觉动画
            };
            
            // 与墙壁碰撞
            this.physics.add.collider(body, this.walls);
            
            // 移除敌人与玩家的碰撞伤害，改为纯碰撞体（不伤害）
            this.physics.add.collider(body, this.playerBody);
            
            return enemy;
            
        } catch (error) {
            console.error('创建敌人时出错:', error);
            return null;
        }
    }
    
    // 创建敌人眼睛（更威胁的设计）
    private createEnemyEyes(x: number, y: number, color: number): Phaser.GameObjects.Graphics {
        const eyes = this.add.graphics();
        
        // 眼睛背景（发光的威胁感）
        eyes.fillStyle(color, 0.4);
        eyes.fillCircle(-5, -5, 5);
        eyes.fillCircle(5, -5, 5);
        
        // 眼睛主体（更大更威胁）
        eyes.fillStyle(0x000000, 1);
        eyes.fillCircle(-5, -5, 4);
        eyes.fillCircle(5, -5, 4);
        
        // 眼睛高光（更小更集中，增强威胁感）
        eyes.fillStyle(0xffffff, 1);
        eyes.fillCircle(-4, -6, 1.5);
        eyes.fillCircle(6, -6, 1.5);
        
        // 眼睛发光效果
        eyes.fillStyle(color, 0.6);
        eyes.fillCircle(-5, -5, 2);
        eyes.fillCircle(5, -5, 2);
        
        eyes.setPosition(x, y);
        eyes.setDepth(71);
        return eyes;
    }
    
    // 创建敌人光环
    private createEnemyAura(x: number, y: number, color: number, radius: number): Phaser.GameObjects.Graphics {
        const aura = this.add.graphics();
        aura.fillStyle(color, 0.3);
        aura.fillCircle(0, 0, radius);
        aura.setPosition(x, y);
        aura.setDepth(69);
        
        // 脉动效果
        this.tweens.add({
            targets: aura,
            scale: [1, 1.1, 1],
            duration: 2000,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        return aura;
    }
    
    // 绘制六边形
    private drawHexagon(graphic: Phaser.GameObjects.Graphics, x: number, y: number, radius: number) {
        graphic.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) graphic.moveTo(px, py);
            else graphic.lineTo(px, py);
        }
        graphic.closePath();
    }
    
    // 生成巡逻路径
    private generatePatrolPath(room: string, startX: number, startY: number): {x: number, y: number}[] {
        const gridSize = 80;
        // 根据房间类型生成不同的巡逻路径（使用网格坐标）
        const rooms = {
            start: { x: 10, y: 10, width: 10, height: 8 },
            left: { x: 10, y: 22, width: 8, height: 6 },
            main: { x: 24, y: 10, width: 12, height: 10 },
            right: { x: 40, y: 10, width: 8, height: 8 },
            treasure: { x: 24, y: 24, width: 10, height: 8 }
        };
        
        const roomDef = rooms[room as keyof typeof rooms];
        if (!roomDef) {
            // 如果没有房间定义，使用起始位置周围的小范围巡逻
            return [
                {x: startX - 80, y: startY - 80},
                {x: startX + 80, y: startY - 80},
                {x: startX + 80, y: startY + 80},
                {x: startX - 80, y: startY + 80}
            ];
        }
        
        // 在房间内生成巡逻路径
        const margin = 1; // 距离墙壁的边距（网格单位）
        const minX = (roomDef.x + margin) * gridSize;
        const maxX = (roomDef.x + roomDef.width - margin) * gridSize;
        const minY = (roomDef.y + margin) * gridSize;
        const maxY = (roomDef.y + roomDef.height - margin) * gridSize;
        
        switch (room) {
            case 'start':
                return [
                    {x: minX + (maxX - minX) * 0.3, y: minY + (maxY - minY) * 0.3},
                    {x: minX + (maxX - minX) * 0.7, y: minY + (maxY - minY) * 0.3},
                    {x: minX + (maxX - minX) * 0.7, y: minY + (maxY - minY) * 0.7},
                    {x: minX + (maxX - minX) * 0.3, y: minY + (maxY - minY) * 0.7}
                ];
                
            case 'left':
                return [
                    {x: minX + (maxX - minX) * 0.2, y: minY + (maxY - minY) * 0.5},
                    {x: minX + (maxX - minX) * 0.6, y: minY + (maxY - minY) * 0.8},
                    {x: minX + (maxX - minX) * 0.2, y: minY + (maxY - minY) * 0.8},
                    {x: minX + (maxX - minX) * 0.2, y: minY + (maxY - minY) * 0.2}
                ];
                
            case 'main':
                return [
                    {x: minX + (maxX - minX) * 0.2, y: minY + (maxY - minY) * 0.2},
                    {x: minX + (maxX - minX) * 0.8, y: minY + (maxY - minY) * 0.2},
                    {x: minX + (maxX - minX) * 0.8, y: minY + (maxY - minY) * 0.8},
                    {x: minX + (maxX - minX) * 0.2, y: minY + (maxY - minY) * 0.8}
                ];
                
            case 'right':
                return [
                    {x: minX + (maxX - minX) * 0.3, y: minY + (maxY - minY) * 0.3},
                    {x: minX + (maxX - minX) * 0.7, y: minY + (maxY - minY) * 0.3},
                    {x: minX + (maxX - minX) * 0.7, y: minY + (maxY - minY) * 0.7},
                    {x: minX + (maxX - minX) * 0.3, y: minY + (maxY - minY) * 0.7}
                ];
                
            case 'treasure':
                return [
                    {x: minX + (maxX - minX) * 0.4, y: minY + (maxY - minY) * 0.4},
                    {x: minX + (maxX - minX) * 0.6, y: minY + (maxY - minY) * 0.6},
                    {x: minX + (maxX - minX) * 0.4, y: minY + (maxY - minY) * 0.6},
                    {x: minX + (maxX - minX) * 0.3, y: minY + (maxY - minY) * 0.5}
                ];
                
            case 'corridor':
            default:
                // 走廊中的随机巡逻点
                return [
                    {x: startX + Phaser.Math.Between(-60, 60), y: startY},
                    {x: startX, y: startY + Phaser.Math.Between(-60, 60)},
                    {x: startX + Phaser.Math.Between(-60, 60), y: startY},
                    {x: startX, y: startY + Phaser.Math.Between(-60, 60)}
                ];
        }
    }
    
    // 添加撤离点 - 参考2.0.1版本的撤离机制
    private addEvacuationPoints() {
        try {
            const gridSize = 80;
            // 定义撤离点位置（基于地图网格系统）
            // 撤离点房间：x: 36, y: 22, width: 8, height: 6
            const evacRoom = { x: 36, y: 22, width: 8, height: 6 };
            const evacCenterX = (evacRoom.x + evacRoom.width / 2) * gridSize; // 3200
            const evacCenterY = (evacRoom.y + evacRoom.height / 2) * gridSize; // 2000
            
            // 起始房间附近也添加一个撤离点
            const startRoom = { x: 10, y: 10, width: 10, height: 8 };
            const startCenterX = (startRoom.x + startRoom.width / 2) * gridSize; // 1200
            const startCenterY = (startRoom.y + startRoom.height / 2) * gridSize; // 1120
            
            const evacPositions = [
                { x: evacCenterX, y: evacCenterY },  // 撤离点房间中心
                { x: startCenterX, y: startCenterY - 200 }    // 起始区域上方
            ];
            
            evacPositions.forEach((pos) => {
                const graphic = this.add.graphics();
                graphic.fillStyle(0x00ff00, 0.3); // 半透明绿色
                graphic.fillCircle(0, 0, 30);
                graphic.lineStyle(3, 0x00ff00, 1);
                graphic.strokeCircle(0, 0, 30);
                graphic.setPosition(pos.x, pos.y);
                graphic.setDepth(40);
                
                // 创建撤离点对象
                const evacPoint: EvacuationPoint = {
                    x: pos.x,
                    y: pos.y,
                    graphic,
                    active: false
                };
                
                this.evacuationPoints.push(evacPoint);
            });
            
            console.log(`添加了 ${this.evacuationPoints.length} 个撤离点`);
            
        } catch (error) {
            console.error('添加撤离点时出错:', error);
        }
    }
    
    // 显示游戏开始提示
    private showGameStartMessage() {
        try {
            const startText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                '按空格键开始游戏\n寻找并收集物品\n避开或击败敌人\n在撤离点撤离',
                {
                    fontSize: '24px',
                    color: '#ffffff',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: { x: 20, y: 15 },
                    align: 'center'
                }
            );
            startText.setOrigin(0.5);
            startText.setScrollFactor(0);
            
            // 监听空格键开始游戏
            this.input.keyboard?.on('keydown-SPACE', () => {
                startText.destroy();
                this.gameStarted = true;
                console.log('游戏开始');
            });
            
        } catch (error) {
            console.error('显示游戏开始提示时出错:', error);
        }
    }
    
    // 更新敌人AI - 智能状态机系统
    private updateEnemies(_delta: number) {
        try {
            const delta = _delta / 16.67; // 标准化到60fps
            
            this.enemies.forEach(enemy => {
                if (!enemy || !enemy.body || !this.playerBody) return;
                
                // 确保使用物理体的实际位置（而非缓存的x/y）
                const enemyX = enemy.body.x;
                const enemyY = enemy.body.y;
                
                const playerDist = Phaser.Math.Distance.Between(
                    enemyX, enemyY,
                    this.playerBody.x, this.playerBody.y
                );
                
                // 重置被击中状态
                if (enemy.isHit) {
                    if (enemy.hitTimer !== undefined) {
                        enemy.hitTimer -= delta;
                        if (enemy.hitTimer <= 0) {
                            enemy.isHit = false;
                            this.resetEnemyColor(enemy);
                        }
                    }
                }
                
                // 检查是否能看到玩家（视线检测）
                const canSeePlayer = this.checkEnemySight(enemy, this.playerBody);
                
                // 根据敌人类型设置不同的检测范围和行为
                // 使用默认值处理可选的type属性
                const enemyType = enemy.type || 'grunt';
                const detectRange = this.getEnemyDetectRange(enemyType);
                const attackRange = this.getEnemyAttackRange(enemyType);
                
                // 更新敌人状态机
                if (canSeePlayer && playerDist < attackRange) {
                    enemy.state = 'attack';
                    enemy.lastPlayerSpotted = this.time.now;
                } else if ((canSeePlayer && playerDist < detectRange) || 
                          (!canSeePlayer && playerDist < detectRange / 2 && enemy.lastPlayerSpotted && this.time
.now - enemy.lastPlayerSpotted < 3000)) {
                    enemy.state = 'chase';
                    enemy.lastPlayerSpotted = this.time.now;
                } else {
                    enemy.state = 'patrol';
                }
                
                // 根据状态执行动作
                switch (enemy.state) {
                    case 'patrol':
                        this.executePatrolBehavior(enemy);
                        break;
                    
                    case 'chase':
                        this.executeChaseBehavior(enemy);
                        break;
                    
                    case 'attack':
                        this.executeAttackBehavior(enemy);
                        break;
                }
                
                // 性能优化：减少眼睛更新频率（每3帧更新一次）
                if (!(enemy as any).eyeUpdateCounter) (enemy as any).eyeUpdateCounter = 0;
                (enemy as any).eyeUpdateCounter++;
                if ((enemy as any).eyeUpdateCounter % 3 === 0) {
                this.updateEnemyEyes(enemy);
                }
                
                // 更新敌人位置和图形
                enemy.x = enemy.body.x;
                enemy.y = enemy.body.y;
                enemy.graphic.setPosition(enemy.x, enemy.y);
                if (enemy.eyeGraphic) {
                    enemy.eyeGraphic.setPosition(enemy.x, enemy.y);
                }
                
                // 更新血量条位置和血量显示
                if (enemy.healthBarBg) {
                    enemy.healthBarBg.setPosition(enemy.x, enemy.y);
                }
                if (enemy.healthBar) {
                    enemy.healthBar.setPosition(enemy.x, enemy.y);
                    // 性能优化：减少血量条重绘频率（每5帧更新一次）
                    if (!(enemy as any).healthUpdateCounter) (enemy as any).healthUpdateCounter = 0;
                    (enemy as any).healthUpdateCounter++;
                    if ((enemy as any).healthUpdateCounter % 5 === 0) {
                        // 更新血量条长度（根据当前血量）
                        const healthPercent = enemy.health / enemy.maxHealth;
                        enemy.healthBar.clear();
                        let healthColor = 0xff0000;
                        switch (enemy.type) {
                            case 'grunt': healthColor = 0xff0000; break;
                            case 'soldier': healthColor = 0xff7700; break;
                            case 'captain': healthColor = 0xff00ff; break;
                        }
                        enemy.healthBar.fillStyle(healthColor, 1);
                        enemy.healthBar.fillRoundedRect(-20, -30, 40 * healthPercent, 4, 1);
                        enemy.healthBar.fillStyle(0xffffff, 0.3);
                        enemy.healthBar.fillRoundedRect(-20, -30, 40 * healthPercent, 2, 1);
                    }
                }
                
                // 更新类型标签位置
                if (enemy.typeLabel) {
                    enemy.typeLabel.setPosition(enemy.x, enemy.y - 45);
                }
                
                // 添加状态视觉反馈（根据敌人状态改变外观）
                this.updateEnemyStateVisual(enemy);
            });
            
        } catch (error) {
            console.error('更新敌人AI时出错:', error);
        }
    }
    
    // 检查敌人视线
    private checkEnemySight(enemy: any, target: any): boolean {
        if (!enemy || !target || !enemy.body || typeof target.x !== 'number' || typeof target.y !== 'number') return false;
        
        // 简化的视线检测（使用距离判断）
        
        // 简化的视线检测（忽略墙壁）
        return true;
    }
    
    // 获取敌人检测范围
    private getEnemyDetectRange(type: string): number {
        switch (type) {
            case 'grunt': return 250;
            case 'soldier': return 350;
            case 'captain': return 450;
            default: return 300;
        }
    }
    
    // 获取敌人攻击范围（射击范围）
    private getEnemyAttackRange(type: string): number {
        switch (type) {
            case 'grunt': return 200;  // 普通敌人射程200
            case 'soldier': return 300; // 士兵射程300
            case 'captain': return 400;  // 队长射程400
            default: return 250;
        }
    }
    
    // 执行巡逻行为
    private executePatrolBehavior(enemy: any) {
        if (!enemy || !enemy.body) return;
        
        if (!enemy.patrolPath || enemy.patrolPath.length === 0) {
            // 如果没有巡逻路径，创建简单的原地巡逻
            if (!enemy.patrolPath) {
                enemy.patrolPath = [
                    { x: enemy.x, y: enemy.y },
                    { x: enemy.x + 50, y: enemy.y },
                    { x: enemy.x + 50, y: enemy.y + 50 },
                    { x: enemy.x, y: enemy.y + 50 }
                ];
                enemy.patrolIndex = 0;
            }
        }
        
        // 确保patrolIndex在有效范围内
        if (enemy.patrolIndex === undefined || enemy.patrolIndex < 0 || enemy.patrolIndex >= enemy.patrolPath.length) {
            enemy.patrolIndex = 0;
        }
        
        const currentTarget = enemy.patrolPath[enemy.patrolIndex];
        // 确保currentTarget存在且有x和y属性
        if (!currentTarget || typeof currentTarget.x !== 'number' || typeof currentTarget.y !== 'number') {
            return;
        }
        
        // 使用物理体的实际位置
        const enemyX = enemy.body.x;
        const enemyY = enemy.body.y;
        const distToTarget = Phaser.Math.Distance.Between(enemyX, enemyY, currentTarget.x, currentTarget.y);
        
        if (distToTarget < 30) {
            // 到达目标点，移动到下一个点
            enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrolPath.length;
        } else {
            // 向当前目标点移动（直接设置速度向量）
            const angle = Phaser.Math.Angle.Between(enemyX, enemyY, currentTarget.x, currentTarget.y);
            const speed = enemy.speed * 0.6; // 巡逻速度稍慢
            if (enemy.body && enemy.body.body) {
                enemy.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            }
        }
    }
    
    // 执行追逐行为
    private executeChaseBehavior(enemy: any) {
        if (!enemy || !enemy.body || !this.playerBody || !enemy.body.body) return;
        
        // 使用物理体的实际位置
        const enemyX = enemy.body.x;
        const enemyY = enemy.body.y;
        
        // 检查是否已经到达攻击距离
        const playerDist = Phaser.Math.Distance.Between(
            enemyX, enemyY,
            this.playerBody.x, this.playerBody.y
        );
        const attackRange = this.getEnemyAttackRange(enemy.type || 'grunt');
        
        // 如果已经在攻击范围内，停止移动，转为攻击状态
        if (playerDist <= attackRange) {
            enemy.body.setVelocity(0, 0);
            enemy.state = 'attack';
            return;
        }
        
        // 根据敌人类型调整追逐策略（直接设置速度向量）
        switch (enemy.type) {
            case 'grunt':
                // 直接追逐
                const angle1 = Phaser.Math.Angle.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
                enemy.body.setVelocity(Math.cos(angle1) * enemy.speed, Math.sin(angle1) * enemy.speed);
                break;
            
            case 'soldier':
                // 预测玩家移动
                const leadTime = 0.2; // 提前量
                const playerVelocity = this.playerBody.body?.velocity || { x: 0, y: 0 };
                const predictedX = this.playerBody.x + playerVelocity.x * leadTime;
                const predictedY = this.playerBody.y + playerVelocity.y * leadTime;
                const angle2 = Phaser.Math.Angle.Between(enemyX, enemyY, predictedX, predictedY);
                const speed2 = enemy.speed * 1.1;
                enemy.body.setVelocity(Math.cos(angle2) * speed2, Math.sin(angle2) * speed2);
                break;
            
            case 'captain':
                // 战略性追逐 - 尝试包抄
                const angle3 = Phaser.Math.Angle.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
                const offsetAngle = (Math.random() - 0.5) * Math.PI / 3; // 随机偏移角度
                const targetX = this.playerBody.x + Math.cos(angle3 + offsetAngle) * 100;
                const targetY = this.playerBody.y + Math.sin(angle3 + offsetAngle) * 100;
                const angle4 = Phaser.Math.Angle.Between(enemyX, enemyY, targetX, targetY);
                const speed4 = enemy.speed * 1.2;
                enemy.body.setVelocity(Math.cos(angle4) * speed4, Math.sin(angle4) * speed4);
                break;
            
            default:
                // 默认追逐行为
                const defaultAngle = Phaser.Math.Angle.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
                enemy.body.setVelocity(Math.cos(defaultAngle) * enemy.speed, Math.sin(defaultAngle) * enemy.speed);
                break;
        }
    }
    
    // 执行攻击行为 - 修改为射击攻击
    private executeAttackBehavior(enemy: any) {
        if (!this.playerBody || !enemy || !enemy.body) return;
        
        // 攻击时停下来（较真实的射击姿态）
        if (enemy.body.body) {
            enemy.body.setVelocity(0, 0);
        }
        
        // 检查是否有视线
        const hasLineOfSight = this.checkEnemySight(enemy, this.playerBody);
        
        if (!hasLineOfSight) {
            enemy.state = 'chase';
            return;
        }
        
        // 射击冷却时间
        let attackCooldown = 2000;
        switch (enemy.type) {
            case 'grunt':
                attackCooldown = 2500;
                break;
            case 'soldier':
                attackCooldown = 1500;
                break;
            case 'captain':
                attackCooldown = 1000;
                break;
        }
        
        if (!enemy.lastAttack || this.time.now - enemy.lastAttack > attackCooldown) {
            this.enemyShoot(enemy);
            enemy.lastAttack = this.time.now;
        }
    }

    
    // 获取敌人攻击颜色
    private getEnemyAttackColor(type: string): number {
        switch (type) {
            case 'grunt': return 0xff6666; // 红色
            case 'soldier': return 0xffaa00; // 橙色
            case 'captain': return 0xff00ff; // 紫色
            default: return 0xff6666;
        }
    }
    
    // 更新敌人状态视觉反馈
    private updateEnemyStateVisual(enemy: any) {
        if (!enemy || !enemy.graphic) return;
        
        // 停止之前的动画
        if (enemy.stateVisualTween) {
            enemy.stateVisualTween.stop();
            enemy.stateVisualTween = null;
        }
        
        // 根据状态设置不同的视觉效果
        switch (enemy.state) {
            case 'patrol':
                // 巡逻状态：正常外观
                enemy.graphic.setTint(0xffffff);
                enemy.graphic.setScale(1.0);
                break;
                
            case 'chase':
                // 追逐状态：红色闪烁，稍微放大
                enemy.graphic.setTint(0xffaaaa);
                enemy.graphic.setScale(1.05);
                enemy.stateVisualTween = this.tweens.add({
                    targets: enemy.graphic,
                    alpha: [0.9, 1.0, 0.9],
                    duration: 300,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;
                
            case 'attack':
                // 攻击状态：强烈红色闪烁，明显放大
                enemy.graphic.setTint(0xff6666);
                enemy.graphic.setScale(1.1);
                enemy.stateVisualTween = this.tweens.add({
                    targets: enemy.graphic,
                    alpha: [0.8, 1.0, 0.8],
                    scale: [1.1, 1.15, 1.1],
                    duration: 200,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;
        }
    }
    
    // 获取敌人眼睛颜色
    private getEnemyEyeColor(type: string): number {
        switch (type) {
            case 'grunt': return 0xff0000; // 红色
            case 'soldier': return 0xff8c00; // 橙色
            case 'captain': return 0x9900ff; // 紫色
            default: return 0xff0000;
        }
    }
    
    // 更新敌人眼睛方向
    private updateEnemyEyes(enemy: any) {
        if (!enemy || !enemy.eyeGraphic || !this.playerBody || !enemy.body) return;
        
        // 根据状态决定眼睛看的方向
        const eyeColor = this.getEnemyEyeColor(enemy.type);
        let angle: number;
            const eyeOffset = 5;
            
        if (enemy.state === 'chase' || enemy.state === 'attack') {
            // 看向玩家（使用物理体的实际位置）
            angle = Phaser.Math.Angle.Between(enemy.body.x, enemy.body.y, this.playerBody.x, this.playerBody.y);
        } else {
            // 巡逻时眼睛看移动方向
            const enemyVelocity = enemy.body.velocity || { x: 0, y: 0 };
            angle = enemyVelocity.x === 0 && enemyVelocity.y === 0 ? 0 : Math.atan2(enemyVelocity.y, enemyVelocity.x);
        }
            
        // 清除并重新绘制眼睛（使用新的威胁眼睛设计）
            enemy.eyeGraphic.clear();
        // 眼睛背景（发光的威胁感）
        enemy.eyeGraphic.fillStyle(eyeColor, 0.4);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset - 5, Math.sin(angle) * eyeOffset - 5, 5);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset + 5, Math.sin(angle) * eyeOffset - 5, 5);
        // 眼睛主体
            enemy.eyeGraphic.fillStyle(0x000000, 1);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset - 5, Math.sin(angle) * eyeOffset - 5, 4);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset + 5, Math.sin(angle) * eyeOffset - 5, 4);
        // 眼睛高光
            enemy.eyeGraphic.fillStyle(0xffffff, 1);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset - 4, Math.sin(angle) * eyeOffset - 6, 1.5);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset + 6, Math.sin(angle) * eyeOffset - 6, 1.5);
        // 眼睛发光效果
        enemy.eyeGraphic.fillStyle(eyeColor, 0.6);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset - 5, Math.sin(angle) * eyeOffset - 5, 2);
        enemy.eyeGraphic.fillCircle(Math.cos(angle) * eyeOffset + 5, Math.sin(angle) * eyeOffset - 5, 2);
    }
    
    // 重置敌人颜色
    private resetEnemyColor(enemy: any) {
        if (!enemy.graphic) return;
        
        // 清除现有图形
        enemy.graphic.clear();
        
        // 根据敌人类型设置颜色和形状 - 与创建时保持一致的精美设计
        switch (enemy.type) {
            case 'grunt':
                // 普通敌人 - 红色威胁机器人设计（与创建时一致）
                // 威胁外圈（红色警告环）
                enemy.graphic.lineStyle(3, 0xff0000, 0.8);
                enemy.graphic.strokeCircle(0, 0, 20);
                
                // 身体主体（更方更硬朗）
                enemy.graphic.fillStyle(0xff4444, 1);
                enemy.graphic.fillRect(-14, -10, 28, 20);
                enemy.graphic.lineStyle(3, 0xcc0000, 1);
                enemy.graphic.strokeRect(-14, -10, 28, 20);
                
                // 头部（更方更威胁）
                enemy.graphic.fillStyle(0xff4444, 1);
                enemy.graphic.fillRoundedRect(-12, -22, 24, 14, 2);
                enemy.graphic.lineStyle(3, 0xcc0000, 1);
                enemy.graphic.strokeRoundedRect(-12, -22, 24, 14, 2);
                
                // 头部顶部装饰（威胁标识）
                enemy.graphic.fillStyle(0xcc0000, 1);
                enemy.graphic.fillRect(-10, -24, 20, 3);
                
                // 身体高光（更暗，增强威胁感）
                enemy.graphic.fillStyle(0xff6666, 1);
                enemy.graphic.fillRect(-10, -8, 20, 10);
                
                // 身体装饰线条（警告条纹）
                enemy.graphic.lineStyle(2, 0xcc0000, 1);
                enemy.graphic.beginPath();
                enemy.graphic.moveTo(-12, 0);
                enemy.graphic.lineTo(12, 0);
                enemy.graphic.strokePath();
                
                // 肩膀装甲（更突出）
                enemy.graphic.fillStyle(0xcc0000, 1);
                enemy.graphic.fillRect(-16, -8, 5, 10);
                enemy.graphic.fillRect(11, -8, 5, 10);
                enemy.graphic.lineStyle(2, 0x990000, 1);
                enemy.graphic.strokeRect(-16, -8, 5, 10);
                enemy.graphic.strokeRect(11, -8, 5, 10);
                
                // 腿部（更粗更稳定）
                enemy.graphic.fillStyle(0xff4444, 1);
                enemy.graphic.fillRect(-7, 10, 6, 10);
                enemy.graphic.fillRect(1, 10, 6, 10);
                enemy.graphic.lineStyle(2, 0xcc0000, 1);
                enemy.graphic.strokeRect(-7, 10, 6, 10);
                enemy.graphic.strokeRect(1, 10, 6, 10);
                
                // 外边框增强（更粗）
                enemy.graphic.lineStyle(4, 0x990000, 1);
                enemy.graphic.strokeRect(-14, -10, 28, 20);
                break;
                
            case 'soldier':
                // 士兵 - 橙色六边形精英机器人设计（与创建时一致）
                // 威胁外圈（橙色警告环）
                enemy.graphic.lineStyle(3, 0xff7700, 0.8);
                enemy.graphic.strokeCircle(0, 0, 22);
                
                // 六边形主体（更大）
                enemy.graphic.fillStyle(0xff7700, 1);
                this.drawHexagon(enemy.graphic, 0, 0, 18);
                enemy.graphic.lineStyle(4, 0xcc5500, 1);
                this.drawHexagon(enemy.graphic, 0, 0, 18);
                
                // 内层六边形（装甲层）
                enemy.graphic.fillStyle(0xffaa33, 1);
                this.drawHexagon(enemy.graphic, 0, 0, 14);
                enemy.graphic.lineStyle(2, 0xcc6600, 1);
                this.drawHexagon(enemy.graphic, 0, 0, 14);
                
                // 中心能量核心（更明显）
                enemy.graphic.fillStyle(0xffffff, 1);
                enemy.graphic.fillCircle(0, 0, 7);
                enemy.graphic.fillStyle(0xff7700, 1);
                enemy.graphic.fillCircle(0, 0, 5);
                enemy.graphic.fillStyle(0xffcc66, 1);
                enemy.graphic.fillCircle(0, 0, 3);
                
                // 装饰角（更突出，像武器）
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const x = Math.cos(angle) * 16;
                    const y = Math.sin(angle) * 16;
                    enemy.graphic.fillStyle(0xcc5500, 1);
                    enemy.graphic.fillCircle(x, y, 4);
                    enemy.graphic.lineStyle(1, 0x993300, 1);
                    enemy.graphic.strokeCircle(x, y, 4);
                }
                
                // 外边框（更粗）
                enemy.graphic.lineStyle(3, 0xcc5500, 1);
                this.drawHexagon(enemy.graphic, 0, 0, 18);
                break;
                
            case 'captain':
                // 队长 - 紫色星形BOSS机器人（与创建时一致）
                // 多重威胁外圈（紫色能量环）
                enemy.graphic.lineStyle(3, 0xff00ff, 0.6);
                enemy.graphic.strokeCircle(0, 0, 28);
                enemy.graphic.lineStyle(2, 0x9900ff, 0.8);
                enemy.graphic.strokeCircle(0, 0, 24);
                
                // 星形主体（更大更威胁）
                enemy.graphic.fillStyle(0x9900ff, 1);
                this.drawStar(enemy.graphic, 0, 0, 22, 14);
                enemy.graphic.lineStyle(4, 0x6600cc, 1);
                this.drawStar(enemy.graphic, 0, 0, 22, 14);
                
                // 内层星形（装甲层）
                enemy.graphic.fillStyle(0xbb66ff, 1);
                this.drawStar(enemy.graphic, 0, 0, 18, 11);
                enemy.graphic.lineStyle(2, 0x8800dd, 1);
                this.drawStar(enemy.graphic, 0, 0, 18, 11);
                
                // 中心能量核心（最强能量）
                enemy.graphic.fillStyle(0xffffff, 1);
                enemy.graphic.fillCircle(0, 0, 9);
                enemy.graphic.fillStyle(0x9900ff, 1);
                enemy.graphic.fillCircle(0, 0, 7);
                enemy.graphic.fillStyle(0xf4d03f, 1);
                enemy.graphic.fillCircle(0, 0, 5);
                enemy.graphic.fillStyle(0xffffff, 0.8);
                enemy.graphic.fillCircle(0, 0, 3);
                
                // 星形装饰点（能量武器）
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i;
                    const x = Math.cos(angle) * 20;
                    const y = Math.sin(angle) * 20;
                    enemy.graphic.fillStyle(0xf4d03f, 1);
                    enemy.graphic.fillCircle(x, y, 3);
                    enemy.graphic.lineStyle(1, 0xffaa00, 1);
                    enemy.graphic.strokeCircle(x, y, 3);
                }
                
                // 外边框增强（更粗更明显）
                enemy.graphic.lineStyle(3, 0x6600cc, 1);
                this.drawStar(enemy.graphic, 0, 0, 22, 14);
                break;
        }
    }
    
    // 检查物品收集
    private checkItemCollection() {
        try {
            if (!this.playerBody) return;
            
            // 使用filter保留未收集的物品
            this.items = this.items.filter(item => {
                if (!item.body) return true;
                
                const dist = Phaser.Math.Distance.Between(
                    this.playerBody.x, this.playerBody.y,
                    item.x, item.y
                );
                
                if (dist < 25) { // 收集距离
                    // 收集物品
                    this.collectItem(item);
                    
                    // 清理额外图形对象（如弹药数量徽章）
                    if ((item as any).extraGraphic) {
                        const extraGraphics = Array.isArray((item as any).extraGraphic) 
                            ? (item as any).extraGraphic 
                            : [(item as any).extraGraphic];
                        extraGraphics.forEach((extra: any) => {
                            if (extra && typeof extra.destroy === 'function') {
                                extra.destroy();
                            }
                        });
                    }
                    
                    // 移除发光效果
                    if (item.glowGraphic) {
                        item.glowGraphic.destroy();
                    }
                    
                    // 移除图形和物理体
                    item.graphic.destroy();
                    item.body.destroy();
                    
                    return false; // 从数组中移除
                }
                
                return true;
            });
            
        } catch (error) {
            console.error('检查物品收集时出错:', error);
        }
    }
    
    // 收集物品
    private collectItem(item: GameItem) {
        try {
            // 先将物品添加到背包（记录收集历史）
            const itemCopy = { ...item }; // 创建副本避免引用问题
            
            switch (item.type) {
                case 'money':
                    this.playerMoney += item.value || 0;
                    this.moneyText.setText(`💰 金钱: $${this.playerMoney}`);
                    // 金钱也记录到背包
                    itemCopy.name = itemCopy.name || `$${item.value}`;
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    break;
                
                case 'medical':
                    // 使用医疗物品
                    this.playerHealth = Math.min(
                        this.playerHealth + (item.value || 0),
                        this.playerMaxHealth
                    );
                    this.updateHealthBar();
                    
                    // 添加收集特效
                    const healEffect = this.add.text(
                        this.playerBody.x - this.cameras.main.scrollX,
                        this.playerBody.y - this.cameras.main.scrollY - 30,
                        `+${item.value || 0} HP`,
                        {
                            fontSize: '16px',
                            color: '#00ff00',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)'
                        }
                    );
                    healEffect.setOrigin(0.5);
                    
                    this.tweens.add({
                        targets: healEffect,
                        y: healEffect.y - 20,
                        alpha: { from: 1, to: 0 },
                        duration: 800,
                        onComplete: () => healEffect.destroy()
                    });
                    
                    // 记录到背包
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    break;
                
                case 'armor':
                    this.playerArmor = Math.min(this.playerArmor + (item.value || 0), 100);
                    this.updateArmorBar();
                    // 记录到背包
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    break;
                
                case 'artifact':
                case 'resource':
                    // 添加到背包
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    // 更新总重量
                    this.totalWeight += (item.weight || 0) * (item.quantity || 1);
                    break;
                
                case 'weapon':
                    // 解锁相应的武器类型
                    let weaponIndex = -1;
                    
                    switch (item.subtype) {
                        case 'rifle':
                            weaponIndex = 1;
                            break;
                        case 'shotgun':
                            weaponIndex = 2;
                            break;
                        case 'sniper':
                            weaponIndex = 3;
                            break;
                    }
                    
                    if (weaponIndex >= 0 && this.weapons[weaponIndex]) {
                        // 为新解锁的武器添加初始弹药
                        const weapon = this.weapons[weaponIndex];
                        weapon.currentAmmo = weapon.ammoCapacity;
                        weapon.reserveAmmo = Math.floor(weapon.maxReserveAmmo * 0.5);
                        
                        // 显示解锁提示
                        const unlockText = this.add.text(
                            this.cameras.main.width / 2,
                            this.cameras.main.height / 2 - 50,
                            `解锁武器: ${weapon.name}!`,
                            {
                                fontSize: '24px',
                                color: '#ffffff',
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: { x: 10, y: 10 }
                            }
                        );
                        unlockText.setOrigin(0.5);
                        unlockText.setScrollFactor(0);
                        
                        this.tweens.add({
                            targets: unlockText,
                            alpha: { from: 1, to: 0 },
                            duration: 2000,
                            onComplete: () => unlockText.destroy()
                        });
                        
                        // 自动切换到新武器
                        this.switchWeapon(weaponIndex);
                    }
                    
                    // 记录到背包
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    break;
                
                case 'ammo':
                    // 为相应武器类型添加弹药
                    let ammoWeaponIndex = -1;
                    let ammoAmount = item.quantity || 10;
                    
                    switch (item.subtype) {
                        case 'rifle':
                            ammoWeaponIndex = 1;
                            ammoAmount = Math.max(ammoAmount, 20); // 步枪弹药更多
                            break;
                        case 'shotgun':
                            ammoWeaponIndex = 2;
                            ammoAmount = Math.max(ammoAmount, 5); // 霰弹弹药较少
                            break;
                        case 'sniper':
                            ammoWeaponIndex = 3;
                            ammoAmount = Math.max(ammoAmount, 3); // 狙击弹药最少
                            break;
                        default:
                            // 默认添加所有武器的弹药
                            for (let i = 1; i < this.weapons.length; i++) {
                                this.addAmmo(i, Math.floor(ammoAmount * 0.5));
                            }
                            break;
                    }
                    
                    if (ammoWeaponIndex >= 0) {
                        this.addAmmo(ammoWeaponIndex, ammoAmount);
                        
                        // 显示弹药收集提示
                        const weaponName = this.weapons[ammoWeaponIndex].name;
                        const ammoText = this.add.text(
                            this.playerBody.x - this.cameras.main.scrollX,
                            this.playerBody.y - this.cameras.main.scrollY - 30,
                            `${weaponName} +${ammoAmount}`,
                            {
                                fontSize: '14px',
                                color: '#ffff00',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)'
                            }
                        );
                        ammoText.setOrigin(0.5);
                        
                        this.tweens.add({
                            targets: ammoText,
                            y: ammoText.y - 15,
                            alpha: { from: 1, to: 0 },
                            duration: 600,
                            onComplete: () => ammoText.destroy()
                        });
                    }
                    
                    // 记录到背包
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    break;
            }
            
            console.log(`收集了物品: ${item.name || item.type}, 背包物品数: ${this.playerBackpack.length}`);
            
            // 随机激活撤离点
            if (Math.random() < 0.2 && !this.evacuationAvailable) {
                this.activateRandomEvacuationPoint();
            }
            
        } catch (error) {
            console.error('收集物品时出错:', error);
        }
    }
    
    // 更新健康条
    private updateHealthBar() {
        try {
            const healthPercent = (this.playerHealth / this.playerMaxHealth) * 100;
            const barWidth = (healthPercent / 100) * 200;
            
            this.playerHealthBar.clear();
            this.playerHealthBar.fillStyle(0xff0000, 1);
            this.playerHealthBar.fillRect(10, 70, barWidth, 20);
            
        } catch (error) {
            console.error('更新健康条时出错:', error);
        }
    }
    
    // 更新护甲条
    private updateArmorBar() {
        try {
            const armorPercent = (this.playerArmor / 100) * 100;
            const barWidth = (armorPercent / 100) * 200;
            
            this.playerArmorBar.clear();
            this.playerArmorBar.fillStyle(0x0066cc, 1);
            this.playerArmorBar.fillRect(10, 100, barWidth, 15);
            
        } catch (error) {
            console.error('更新护甲条时出错:', error);
        }
    }
    
    // 玩家受到伤害
    private damagePlayer(amount: number) {
        try {
            if (this.playerIsInvincible) return; // 无敌状态不受伤
            
            // 计算实际伤害（考虑护甲减免）
            // 护甲减免公式：实际伤害 = 原始伤害 * (1 - 护甲值 / (护甲值 + 100))
            // 这样护甲值越高，减免百分比越高，但有递减效果
            let actualDamage = amount;
            if (this.playerArmor > 0) {
                const armorReduction = this.playerArmor / (this.playerArmor + 100); // 护甲减免百分比
                actualDamage = amount * (1 - armorReduction);
                
                // 护甲也会受到一定伤害（耐久度概念）
                const armorDamage = Math.min(amount * 0.3, this.playerArmor * 0.1);
                this.playerArmor = Math.max(0, this.playerArmor - armorDamage);
            }
            
            this.playerHealth -= actualDamage;
            
            // 触发相机摇晃效果，伤害越大摇晃越强烈
            this.createCameraShake(Math.min(actualDamage * 0.5, 15), 200);
            
            // 更新UI
            this.updateHealthBar();
            this.updateArmorBar();
            
            // 受伤特效 - 屏幕闪烁
            const flash = this.add.graphics();
            flash.fillStyle(0xff0000, 0.3);
            flash.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
            flash.setScrollFactor(0);
            
            this.tweens.add({
                targets: flash,
                alpha: { from: 0.3, to: 0 },
                duration: 200,
                onComplete: () => flash.destroy()
            });
            
            // 无敌时间
            this.playerIsInvincible = true;
            this.time.delayedCall(1000, () => {
                this.playerIsInvincible = false;
            });
            
            // 检查玩家是否死亡
            if (this.playerHealth <= 0) {
                this.playerHealth = 0;
                this.gameOver(false);
            }
            
        } catch (error) {
            console.error('玩家受到伤害时出错:', error);
        }
    }
    
    // 伤害敌人
    private damageEnemy(enemy: any, amount: number) {
        try {
            if (!enemy || enemy.health <= 0) return;
            
            // 扣除生命值
            enemy.health -= amount;
            
            // 更新血量条
            this.updateEnemyHealthBar(enemy);
            
            // 播放击中音效
            this.playHitSound();
            
            // 被击中效果
            enemy.isHit = true;
            enemy.hitTimer = 20; // 帧数
            
            // 变红效果 - 使用tint而不是清除图形，避免破坏敌人外观
            enemy.graphic.setTint(0xff0000);
            
            // 短暂变红后恢复
            this.time.delayedCall(100, () => {
                if (enemy && enemy.graphic) {
                    enemy.graphic.clearTint();
                }
            });
            
            // 被击中击退效果
            const enemyX = enemy.body.x;
            const enemyY = enemy.body.y;
            const angle = Phaser.Math.Angle.Between(this.playerBody.x, this.playerBody.y, enemyX, enemyY);
            enemy.body.setVelocity(
                Math.cos(angle) * 50,
                Math.sin(angle) * 50
            );
            
            // 击中特效
            const hitEffect = this.add.graphics();
            hitEffect.fillStyle(0xffffff, 0.8);
            hitEffect.fillCircle(enemyX, enemyY, 10);
            hitEffect.setDepth(65);
            
            this.tweens.add({
                targets: hitEffect,
                scale: { from: 0.5, to: 1.5 },
                alpha: { from: 0.8, to: 0 },
                duration: 200,
                onComplete: () => hitEffect.destroy()
            });
            
            // 检查是否死亡
            if (enemy.health <= 0) {
                this.killEnemy(enemy);
            }
        } catch (error) {
            console.error('伤害敌人时出错:', error);
        }
    }
    
    // 更新敌人血量条
    private updateEnemyHealthBar(enemy: any) {
        if (!enemy.healthBar || !enemy.maxHealth) return;
        
        const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
        const barWidth = 40 * healthPercent;
        
        // 根据血量百分比改变颜色
        let healthColor = 0x00ff00; // 绿色
        if (healthPercent < 0.3) {
            healthColor = 0xff0000; // 红色
        } else if (healthPercent < 0.6) {
            healthColor = 0xffaa00; // 橙色
        }
        
        enemy.healthBar.clear();
        enemy.healthBar.fillStyle(healthColor, 1);
        enemy.healthBar.fillRect(-20, -30, barWidth, 4);
    }

    
    // 敌人射击
    private enemyShoot(enemy: any) {
        if (!this.playerBody || !this.gameStarted || !enemy || !enemy.body) return;
        
        // 使用物理体的实际位置
        const enemyX = enemy.body.x;
        const enemyY = enemy.body.y;
        const angle = Phaser.Math.Angle.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
        
        let damage = 10;
        let bulletColor = 0xff0000;
        let accuracy = 0.9;
        
        switch (enemy.type) {
            case 'grunt':
                damage = 8;
                bulletColor = 0xff6666;
                accuracy = 0.7;
                break;
            case 'soldier':
                damage = 12;
                bulletColor = 0xffaa00;
                accuracy = 0.85;
                break;
            case 'captain':
                damage = 15;
                bulletColor = 0xff00ff;
                accuracy = 0.95;
                break;
        }
        
        const angleError = (1 - accuracy) * (Math.random() * 2 - 1) * 0.3;
        const finalAngle = angle + angleError;
        
        // 优化枪口闪光效果 - 改为小闪光
        const muzzleFlash = this.add.graphics();
        muzzleFlash.fillStyle(bulletColor, 0.9);
        muzzleFlash.fillCircle(enemyX, enemyY, 8); // 减小半径从12到8
        // 添加外圈光晕
        muzzleFlash.fillStyle(0xffffff, 0.6);
        muzzleFlash.fillCircle(enemyX, enemyY, 4);
        muzzleFlash.setDepth(65);
        
        this.tweens.add({
            targets: muzzleFlash,
            scale: { from: 1, to: 1.5 }, // 减小缩放从2到1.5
            alpha: { from: 0.9, to: 0 },
            duration: 100, // 加快消失速度从150到100
            onComplete: () => muzzleFlash.destroy()
        });
        
        const range = 600;
        const bulletEndX = enemyX + Math.cos(finalAngle) * range;
        const bulletEndY = enemyY + Math.sin(finalAngle) * range;
        
        const hitPoint = this.raycastHitWall(enemyX, enemyY, bulletEndX, bulletEndY);
        const actualEndX = hitPoint ? hitPoint.x : bulletEndX;
        const actualEndY = hitPoint ? hitPoint.y : bulletEndY;
        
        // 如果击中墙壁，显示击中特效
        if (hitPoint) {
            this.createWallHitEffect(hitPoint.x, hitPoint.y, finalAngle);
        }
        
        // 子弹轨迹线
        const bulletLine = this.add.graphics();
        bulletLine.lineStyle(3, bulletColor, 0.8);
        bulletLine.beginPath();
        bulletLine.moveTo(enemyX, enemyY);
        bulletLine.lineTo(actualEndX, actualEndY);
        bulletLine.strokePath();
        bulletLine.setDepth(60);
        
        this.tweens.add({
            targets: bulletLine,
            alpha: { from: 0.8, to: 0 },
            duration: 200,
            onComplete: () => bulletLine.destroy()
        });
        
        // 伤害判定 - 优化角度容差
        const playerDist = Phaser.Math.Distance.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
        const wallDist = hitPoint ? Phaser.Math.Distance.Between(enemyX, enemyY, hitPoint.x, hitPoint.y) : Infinity;
        
        // 玩家在射程内且没有被墙壁阻挡
        if (playerDist < range && playerDist < wallDist) {
            const actualAngle = Phaser.Math.Angle.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
            const angleDiff = Math.abs(Phaser.Math.Angle.ShortestBetween(finalAngle * 180 / Math.PI, actualAngle * 180 / Math.PI));
            
            // 放宽角度容差，根据敌人类型和距离调整
            let hitAngleTolerance = 20; // 基础容差20度
            
            // 根据敌人精度调整容差
            if (accuracy < 0.75) {
                hitAngleTolerance = 25; // Grunt更宽容差
            } else if (accuracy > 0.9) {
                hitAngleTolerance = 15; // Captain更严格
            }
            
            // 距离越远，容差越大
            const distanceFactor = Math.min(playerDist / 300, 1.5);
            hitAngleTolerance *= distanceFactor;
            
            if (angleDiff < hitAngleTolerance) {
                // 命中玩家！
                this.damagePlayer(damage);
                
                // 击中特效
                const hitEffect = this.add.graphics();
                hitEffect.fillStyle(bulletColor, 0.7);
                hitEffect.fillCircle(this.playerBody.x, this.playerBody.y, 15);
                hitEffect.fillStyle(0xffffff, 0.9);
                hitEffect.fillCircle(this.playerBody.x, this.playerBody.y, 8);
                hitEffect.setDepth(101);
                
                this.tweens.add({
                    targets: hitEffect,
                    scale: { from: 1, to: 2 },
                    alpha: { from: 0.7, to: 0 },
                    duration: 300,
                    onComplete: () => hitEffect.destroy()
                });
                
                // 屏幕震动效果
                this.cameras.main.shake(100, 0.005);
            }
        }
        
        this.playEnemyShootSound();
    }
    
    // 敌人射击音效
    private playEnemyShootSound() {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(70, audioContext.currentTime + 0.05);
            
            gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            
            oscillator.onended = () => {
                oscillator.disconnect();
                gainNode.disconnect();
            };
        } catch (error) {
            console.error('播放敌人射击音效时出错:', error);
        }
    }

    
    // 播放击中音效
    private playHitSound() {
        try {
            this.sound.play('hitSound', { volume: 0.5 });
        } catch (error) {
            console.error('播放击中音效时出错:', error);
        }
    }
    
    // 播放死亡音效
    private playDeathSound() {
        try {
            this.sound.play('deathSound', { volume: 0.5 });
        } catch (error) {
            console.error('播放死亡音效时出错:', error);
        }
    }
    
    // 播放撤离音效
    private playEvacuationSound() {
        try {
            this.sound.play('evacuationSound', { volume: 0.5 });
        } catch (error) {
            console.error('播放撤离音效时出错:', error);
        }
    }
    
    // 播放背景音乐
    private playBackgroundMusic() {
        try {
            this.backgroundMusic = this.sound.add('backgroundMusic', { loop: true });
            this.backgroundMusic.play({ volume: 0.3 });
        } catch (error) {
            console.error('播放背景音乐时出错:', error);
        }
    }
    
    // 停止背景音乐
    private stopBackgroundMusic() {
        try {
            this.backgroundMusic?.stop();
        } catch (error) {
            console.error('停止背景音乐时出错:', error);
        }
    }


    
    // 检查玩家是否在撤离点
    private checkPlayerInEvacuationPoint() {
        try {
            if (!this.playerBody || !this.evacuationAvailable) return;
            
            this.evacuationPoints.forEach((evacPoint) => {
                if (evacPoint.active) {
                    const dist = Phaser.Math.Distance.Between(
                        this.playerBody.x, this.playerBody.y,
                        evacPoint.x, evacPoint.y
                    );
                    
                    if (dist < 50) { // 撤离距离
                        this.evacuatePlayer();
                    }
                }
            });
            
        } catch (error) {
            console.error('检查玩家是否在撤离点时出错:', error);
        }
    }
    
    // 完成撤离
    private completeEvacuation() {
        try {
            this.gameStarted = false;
            this.evacuationAvailable = false;
            this.physics.pause();
            this.stopBackgroundMusic();
            this.playEvacuationSound();
            
            // 显示撤离成功提示
            const evacText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                '撤离成功！',
                {
                    fontSize: '64px',
                    color: '#00ff00',
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    padding: { x: 40, y: 30 },
                    stroke: '#ffffff',
                    strokeThickness: 4
                }
            );
            evacText.setOrigin(0.5);
            evacText.setScrollFactor(0);
            evacText.setDepth(5000);
            
            // 2秒后跳转到仓库场景
            this.time.delayedCall(2000, () => {
                    evacText.destroy();
                // 将背包物品转换为仓库格式
                const warehouseItems = this.convertBackpackToWarehouseItems();
                
                // 保存玩家金钱到本地存储（确保持久化）
                try {
                    localStorage.setItem('player_money', this.playerMoney.toString());
                    console.log(`保存玩家金钱: $${this.playerMoney}`);
                } catch (error) {
                    console.warn('无法保存玩家金钱:', error);
                }
                
                // 跳转到仓库场景，传递背包数据和玩家数据
                this.scene.start('WarehouseScene', {
                    playerHealth: this.playerHealth,
                    playerMoney: this.playerMoney,
                    backpackItems: warehouseItems,
                    fromEvacuation: true
                });
            });
            
        } catch (error) {
            console.error('完成撤离时出错:', error);
        }
    }
    
    // 将背包物品转换为仓库物品格式
    private convertBackpackToWarehouseItems(): any[] {
        const warehouseItems: any[] = [];
        
        // 按类型分组背包物品
        const itemMap = new Map<string, any>();
        
        this.playerBackpack.forEach(item => {
            const key = item.name || item.type;
            if (itemMap.has(key)) {
                // 如果已存在，增加数量
                const existing = itemMap.get(key);
                existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
            } else {
                // 创建新的仓库物品
                const warehouseItem = {
                    id: Date.now() + Math.random(), // 生成唯一ID
                    type: this.mapItemTypeToWarehouseType(item.type),
                    name: item.name || this.getItemNameByType(item.type),
                    value: item.value || this.getItemDefaultValue(item.type),
                    quantity: item.quantity || 1,
                    description: this.getItemDescription(item.type)
                };
                itemMap.set(key, warehouseItem);
            }
        });
        
        // 转换为数组
        itemMap.forEach(item => {
            warehouseItems.push(item);
        });
        
        return warehouseItems;
    }
    
    // 映射物品类型到仓库类型
    private mapItemTypeToWarehouseType(type: string): string {
        const typeMap: { [key: string]: string } = {
            'weapon': 'WEAPON',
            'ammo': 'AMMO',
            'armor': 'ARMOR',
            'medical': 'MEDICAL',
            'artifact': 'VALUABLE',
            'money': 'VALUABLE',
            'resource': 'VALUABLE'
        };
        return typeMap[type] || 'VALUABLE';
    }
    
    // 根据类型获取物品名称
    private getItemNameByType(type: string): string {
        const nameMap: { [key: string]: string } = {
            'weapon': '武器',
            'ammo': '弹药',
            'armor': '护甲',
            'medical': '医疗用品',
            'artifact': '工艺品',
            'money': '现金',
            'resource': '资源'
        };
        return nameMap[type] || '未知物品';
    }
    
    // 根据类型获取默认价值
    private getItemDefaultValue(type: string): number {
        const valueMap: { [key: string]: number } = {
            'weapon': 500,
            'ammo': 50,
            'armor': 300,
            'medical': 200,
            'artifact': 1000,
            'money': 100,
            'resource': 50
        };
        return valueMap[type] || 100;
    }
    
    // 根据类型获取描述
    private getItemDescription(type: string): string {
        const descMap: { [key: string]: string } = {
            'weapon': '战斗武器',
            'ammo': '弹药补给',
            'armor': '防护装备',
            'medical': '医疗用品',
            'artifact': '贵重物品',
            'money': '现金',
            'resource': '资源材料'
        };
        return descMap[type] || '物品';
    }
    
    // 玩家撤离（保留旧方法以兼容）
    private evacuatePlayer() {
        this.completeEvacuation();
    }

    
    // 绘制星形
    private drawStar(graphic: Phaser.GameObjects.Graphics, x: number, y: number, points: number, radius: number) {
        graphic.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI / points) * i;
            const r = i % 2 === 0 ? radius : radius / 2;
            const px = x + r * Math.cos(angle);
            const py = y + r * Math.sin(angle);
            if (i === 0) graphic.moveTo(px, py);
            else graphic.lineTo(px, py);
        }
        graphic.closePath();
    }
    
    // 切换背包显示
    private toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
        
        if (this.isInventoryOpen) {
            this.openInventory();
        } else {
            this.closeInventory();
        }
    }
    
    // 打开背包 - 美化界面
    private openInventory() {
        // 暂停游戏
        this.physics.pause();
        
        // 显示鼠标光标
        this.input.setDefaultCursor('default');
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 创建背景 - 添加模糊效果和交互
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.9);
        bg.fillRect(0, 0, width, height);
        bg.setScrollFactor(0);
        bg.setDepth(2000);
        bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        
        // 创建背包容器
        this.inventoryPanel = this.add.container(0, 0);
        this.inventoryPanel.setDepth(2001);
        this.inventoryPanel.add(bg);
        
        // 顶部标题栏 - 更精致
        const titleBar = this.add.graphics();
        titleBar.fillStyle(0x2c3e50, 0.95);
        titleBar.fillRoundedRect(width / 2 - 450, 30, 900, 60, 15);
        titleBar.lineStyle(3, 0x3498db, 0.8);
        titleBar.strokeRoundedRect(width / 2 - 450, 30, 900, 60, 15);
        // 顶部装饰条
        titleBar.fillStyle(0x3498db, 0.3);
        titleBar.fillRoundedRect(width / 2 - 450, 30, 900, 15, 15);
        titleBar.setScrollFactor(0);
        this.inventoryPanel.add(titleBar);
        
        // 标题文字 - 添加图标和阴影
        const title = this.add.text(width / 2, 60, '🎒 背包系统', {
            fontSize: '36px',
            color: '#ecf0f1',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        title.setOrigin(0.5);
        title.setScrollFactor(0);
        this.inventoryPanel.add(title);
        
        // 关闭提示
        const closeHint = this.add.text(width / 2, 100, '按 TAB 或 ESC 关闭 | 点击物品查看详情', {
            fontSize: '14px',
            color: '#95a5a6',
            stroke: '#000000',
            strokeThickness: 2
        });
        closeHint.setOrigin(0.5);
        closeHint.setScrollFactor(0);
        this.inventoryPanel.add(closeHint);
        
        // 左侧：装备区域
        this.createEquipmentPanel(100, 140);
        
        // 右侧：物品列表（支持交互）
        this.createItemsPanel(width / 2 + 50, 140);
        
        // 底部：统计信息
        this.createStatsPanel(100, height - 160);
    }
    
    // 创建装备面板 - 美化版
    private createEquipmentPanel(x: number, y: number) {
        if (!this.inventoryPanel) return;
        
        // 装备区标题背景
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x2c3e50, 0.9);
        titleBg.fillRoundedRect(x, y - 40, 350, 35, 8);
        titleBg.lineStyle(2, 0xf39c12, 0.6);
        titleBg.strokeRoundedRect(x, y - 40, 350, 35, 8);
        titleBg.setScrollFactor(0);
        this.inventoryPanel.add(titleBg);
        
        // 装备区标题
        const equipTitle = this.add.text(x + 175, y - 22, '⚔ 当前装备', {
            fontSize: '20px',
            color: '#f39c12',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        equipTitle.setOrigin(0.5);
        equipTitle.setScrollFactor(0);
        this.inventoryPanel.add(equipTitle);
        
        // 装备槽背景 - 更精致的设计
        const equipBg = this.add.graphics();
        // 外层发光
        equipBg.fillStyle(0x3498db, 0.1);
        equipBg.fillRoundedRect(x - 3, y - 3, 356, 406, 13);
        // 主背景
        equipBg.fillStyle(0x1a1a1a, 0.95);
        equipBg.fillRoundedRect(x, y, 350, 400, 10);
        // 内部装饰线
        equipBg.lineStyle(2, 0x34495e, 0.8);
        equipBg.strokeRoundedRect(x, y, 350, 400, 10);
        // 顶部高光
        equipBg.fillStyle(0xffffff, 0.05);
        equipBg.fillRoundedRect(x, y, 350, 80, 10);
        equipBg.setScrollFactor(0);
        this.inventoryPanel.add(equipBg);
        
        // 武器信息
        const weaponIndex = (this as any).currentWeaponIndex || 0;
        const weapon = this.weapons[weaponIndex];
        
        let yOffset = y + 20;
        
        // 主武器
        // 主武器 - 添加装饰框
        const weaponBox = this.add.graphics();
        weaponBox.fillStyle(0x2c3e50, 0.5);
        weaponBox.fillRoundedRect(x + 10, yOffset - 5, 330, 100, 8);
        weaponBox.lineStyle(2, 0xe74c3c, 0.5);
        weaponBox.strokeRoundedRect(x + 10, yOffset - 5, 330, 100, 8);
        weaponBox.setScrollFactor(0);
        this.inventoryPanel.add(weaponBox);
        
        const weaponText = this.add.text(x + 20, yOffset, `🔫 ${weapon.name}`, {
            fontSize: '18px',
            color: '#e74c3c',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        weaponText.setScrollFactor(0);
        this.inventoryPanel.add(weaponText);
        yOffset += 30;
        
        const ammoText = this.add.text(x + 40, yOffset, `📦 ${weapon.currentAmmo}/${weapon.ammoCapacity} (备弹: ${weapon.reserveAmmo})`, {
            fontSize: '14px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 2
        });
        ammoText.setScrollFactor(0);
        this.inventoryPanel.add(ammoText);
        yOffset += 25;
        
        const damageText = this.add.text(x + 40, yOffset, `⚡ 伤害: ${weapon.damage}`, {
            fontSize: '14px',
            color: '#ff6666',
            stroke: '#000000',
            strokeThickness: 2
        });
        damageText.setScrollFactor(0);
        this.inventoryPanel.add(damageText);
        yOffset += 25;
        
        const rangeText = this.add.text(x + 40, yOffset, `🎯 射程: ${weapon.range}`, {
            fontSize: '14px',
            color: '#66ff66',
            stroke: '#000000',
            strokeThickness: 2
        });
        rangeText.setScrollFactor(0);
        this.inventoryPanel.add(rangeText);
        yOffset += 40;
        
        // 护甲区域装饰框
        const armorBox = this.add.graphics();
        armorBox.fillStyle(0x2c3e50, 0.5);
        armorBox.fillRoundedRect(x + 10, yOffset - 5, 330, 80, 8);
        armorBox.lineStyle(2, 0x3498db, 0.5);
        armorBox.strokeRoundedRect(x + 10, yOffset - 5, 330, 80, 8);
        armorBox.setScrollFactor(0);
        this.inventoryPanel.add(armorBox);
        
        // 护甲
        const armorText = this.add.text(x + 20, yOffset, `🛡 护甲: ${Math.floor(this.playerArmor)}/100`, {
            fontSize: '18px',
            color: '#3498db',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        armorText.setScrollFactor(0);
        this.inventoryPanel.add(armorText);
        yOffset += 30;
        
        // 护甲条
        const armorBarBg = this.add.graphics();
        armorBarBg.fillStyle(0x333333, 1);
        armorBarBg.fillRect(x + 40, yOffset, 270, 15);
        armorBarBg.setScrollFactor(0);
        this.inventoryPanel.add(armorBarBg);
        
        const armorBar = this.add.graphics();
        const armorWidth = (this.playerArmor / 100) * 270;
        armorBar.fillStyle(0x3498db, 1);
        armorBar.fillRect(x + 40, yOffset, armorWidth, 15);
        armorBar.setScrollFactor(0);
        this.inventoryPanel.add(armorBar);
        yOffset += 40;
        
        // 生命值区域装饰框
        const healthBox = this.add.graphics();
        healthBox.fillStyle(0x2c3e50, 0.5);
        healthBox.fillRoundedRect(x + 10, yOffset - 5, 330, 80, 8);
        healthBox.lineStyle(2, 0x2ecc71, 0.5);
        healthBox.strokeRoundedRect(x + 10, yOffset - 5, 330, 80, 8);
        healthBox.setScrollFactor(0);
        this.inventoryPanel.add(healthBox);
        
        // 生命值
        const healthText = this.add.text(x + 20, yOffset, `❤ 生命值: ${Math.floor(this.playerHealth)}/${this.playerMaxHealth}`, {
            fontSize: '18px',
            color: '#e74c3c',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        healthText.setScrollFactor(0);
        this.inventoryPanel.add(healthText);
        yOffset += 30;
        
        // 生命值条
        const healthBarBg = this.add.graphics();
        healthBarBg.fillStyle(0x333333, 1);
        healthBarBg.fillRect(x + 40, yOffset, 270, 15);
        healthBarBg.setScrollFactor(0);
        this.inventoryPanel.add(healthBarBg);
        
        const healthBar = this.add.graphics();
        const healthWidth = (this.playerHealth / this.playerMaxHealth) * 270;
        let healthColor = 0x2ecc71;
        if (this.playerHealth / this.playerMaxHealth < 0.3) {
            healthColor = 0xe74c3c;
        } else if (this.playerHealth / this.playerMaxHealth < 0.6) {
            healthColor = 0xf39c12;
        }
        healthBar.fillStyle(healthColor, 1);
        healthBar.fillRect(x + 40, yOffset, healthWidth, 15);
        healthBar.setScrollFactor(0);
        this.inventoryPanel.add(healthBar);
    }
    
    // 创建物品面板 - 网格布局（类似仓库）
    private createItemsPanel(x: number, y: number) {
        if (!this.inventoryPanel) return;
        
        // 物品区标题背景
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x2c3e50, 0.9);
        titleBg.fillRoundedRect(x, y - 40, 450, 35, 8);
        titleBg.lineStyle(2, 0xf39c12, 0.6);
        titleBg.strokeRoundedRect(x, y - 40, 450, 35, 8);
        titleBg.setScrollFactor(0);
        this.inventoryPanel.add(titleBg);
        
        // 物品区标题
        const itemsTitle = this.add.text(x + 225, y - 22, `📦 背包物品 (${this.playerBackpack.length}/12)`, {
            fontSize: '20px',
            color: '#f39c12',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        itemsTitle.setOrigin(0.5);
        itemsTitle.setScrollFactor(0);
        this.inventoryPanel.add(itemsTitle);
        
        // 物品网格背景 - 更精致
        const itemsBg = this.add.graphics();
        // 外层发光
        itemsBg.fillStyle(0x3498db, 0.1);
        itemsBg.fillRoundedRect(x - 3, y - 3, 456, 406, 13);
        // 主背景
        itemsBg.fillStyle(0x1a1a1a, 0.95);
        itemsBg.fillRoundedRect(x, y, 450, 400, 10);
        // 边框
        itemsBg.lineStyle(2, 0x34495e, 0.8);
        itemsBg.strokeRoundedRect(x, y, 450, 400, 10);
        // 顶部高光
        itemsBg.fillStyle(0xffffff, 0.05);
        itemsBg.fillRoundedRect(x, y, 450, 60, 10);
        itemsBg.setScrollFactor(0);
        this.inventoryPanel.add(itemsBg);
        
        // 网格布局参数
        const slotsPerRow = 4; // 每行4个物品槽
        const slotSize = 85;
        const slotSpacing = 12;
        const startX = x + 25;
        const startY = y + 70;
        const maxSlots = 12;
        
        // 创建物品槽位网格
        for (let i = 0; i < maxSlots; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            
            const slotX = startX + col * (slotSize + slotSpacing);
            const slotY = startY + row * (slotSize + slotSpacing);
            
            // 创建物品槽
            const slot = this.add.graphics();
            slot.fillStyle(0x2c3e50, 0.8);
            slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            slot.lineStyle(2, 0x3498db, 0.6);
            slot.strokeRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            slot.setScrollFactor(0);
            slot.setInteractive(new Phaser.Geom.Rectangle(slotX, slotY, slotSize, slotSize), Phaser.Geom.Rectangle.Contains);
            
            // 槽位交互效果
            slot.on('pointerover', () => {
                slot.clear();
                slot.fillStyle(0x2c3e50, 0.8);
                slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 8);
                slot.lineStyle(3, 0xf39c12);
                slot.strokeRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            });
            
            slot.on('pointerout', () => {
                slot.clear();
                slot.fillStyle(0x2c3e50, 0.8);
                slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 8);
                slot.lineStyle(2, 0x3498db, 0.6);
                slot.strokeRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            });
            
            this.inventoryPanel.add(slot);
            
            // 如果槽位有物品，显示物品
            if (i < this.playerBackpack.length) {
                const item = this.playerBackpack[i];
                this.createBackpackItemInSlot(slotX + slotSize / 2, slotY + slotSize / 2, item, i);
            }
        }
        
        // 如果背包为空，显示提示
        if (this.playerBackpack.length === 0) {
            const emptyIcon = this.add.text(x + 225, y + 200, '📭', {
                fontSize: '48px'
            });
            emptyIcon.setOrigin(0.5);
            emptyIcon.setScrollFactor(0);
            this.inventoryPanel.add(emptyIcon);
            
            const emptyText = this.add.text(x + 225, y + 250, '背包空空如也', {
                fontSize: '18px',
                color: '#7f8c8d',
                stroke: '#000000',
                strokeThickness: 2
            });
            emptyText.setOrigin(0.5);
            emptyText.setScrollFactor(0);
            this.inventoryPanel.add(emptyText);
        }
    }
    
    // 在背包槽位中创建物品
    private createBackpackItemInSlot(centerX: number, centerY: number, item: GameItem, _slotIndex: number) {
        if (!this.inventoryPanel) return;
        
        // 创建物品容器
        const itemContainer = this.add.container(centerX, centerY);
        itemContainer.setScrollFactor(0);
        
        // 获取物品颜色
        const itemColor = this.getItemColorForType(item.type);
        
        // 创建物品图标
        const itemIcon = this.add.graphics();
        itemIcon.fillStyle(itemColor);
        itemIcon.fillCircle(0, 0, 30);
        itemIcon.lineStyle(2, 0xecf0f1);
        itemIcon.strokeCircle(0, 0, 30);
        
        // 物品名称（简化显示）
        const itemName = item.name || this.getItemTypeName(item.type);
        const itemText = this.add.text(0, -25, itemName.length > 6 ? itemName.substring(0, 6) + '...' : itemName, {
            font: 'bold 10px Arial',
            color: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 1
        });
        itemText.setOrigin(0.5);
        
        // 物品数量
        const quantityText = this.add.text(0, 0, `${item.quantity || 1}`, {
            font: 'bold 16px Arial',
            color: '#f39c12',
            stroke: '#2c3e50',
                        strokeThickness: 2
                    });
        quantityText.setOrigin(0.5);
        
        // 物品价值
        const valueText = this.add.text(0, 25, `$${item.value || 0}`, {
            font: 'bold 10px Arial',
            color: '#2ecc71',
            stroke: '#2c3e50',
            strokeThickness: 1
        });
        valueText.setOrigin(0.5);
        
        // 将所有元素添加到容器
        itemContainer.add([itemIcon, itemText, quantityText, valueText]);
        itemContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
        
        // 悬停效果
        itemContainer.on('pointerover', () => {
            itemContainer.setScale(1.15);
                        this.input.setDefaultCursor('pointer');
            // 显示详细信息
            this.showItemDetails(item, centerX + 50, centerY);
        });
        
        itemContainer.on('pointerout', () => {
            itemContainer.setScale(1);
                        this.input.setDefaultCursor('default');
                    });
        
        itemContainer.on('pointerdown', () => {
            this.showItemDetails(item, centerX + 50, centerY);
        });
        
        this.inventoryPanel.add(itemContainer);
    }
    
    // 获取物品类型对应的颜色
    private getItemColorForType(type: string): number {
        const colorMap: { [key: string]: number } = {
            'weapon': 0xe74c3c,    // 红色
            'ammo': 0xf39c12,      // 橙色
            'armor': 0x3498db,     // 蓝色
            'medical': 0x2ecc71,   // 绿色
            'artifact': 0xf1c40f,  // 黄色
            'money': 0x2ecc71,     // 绿色
            'resource': 0x9b59b6   // 紫色
        };
        return colorMap[type] || 0x95a5a6; // 默认灰色
    }
    
    // 创建统计面板 - 美化版
    private createStatsPanel(x: number, y: number) {
        if (!this.inventoryPanel) return;
        
        const width = this.cameras.main.width - 200;
        
        // 统计背景 - 更精致
        const statsBg = this.add.graphics();
        // 外层发光
        statsBg.fillStyle(0x2ecc71, 0.15);
        statsBg.fillRoundedRect(x - 3, y - 3, width + 6, 106, 13);
        // 主背景
        statsBg.fillStyle(0x2c3e50, 0.95);
        statsBg.fillRoundedRect(x, y, width, 100, 10);
        // 边框
        statsBg.lineStyle(3, 0x3498db, 0.8);
        statsBg.strokeRoundedRect(x, y, width, 100, 10);
        // 顶部装饰
        statsBg.fillStyle(0x3498db, 0.2);
        statsBg.fillRoundedRect(x, y, width, 25, 10);
        statsBg.setScrollFactor(0);
        this.inventoryPanel.add(statsBg);
        
        // 统计信息
        const stats = [
            { label: '金钱', value: `$${this.playerMoney}`, color: '#ffd700' },
            { label: '击杀', value: `${this.enemiesKilled}`, color: '#ff6666' },
            { label: '收集', value: `${this.collectedItems}`, color: '#66ff66' },
            { label: '时间', value: `${Math.floor(this.gameTime)}s`, color: '#6699ff' },
            { label: '背包', value: `${this.playerBackpack.length}`, color: '#ffaa00' }
        ];
        
        const statSpacing = width / stats.length;
        stats.forEach((stat, index) => {
            const statX = x + statSpacing * index + statSpacing / 2;
            
            const label = this.add.text(statX, y + 30, stat.label, {
                fontSize: '14px',
                color: '#95a5a6',
                stroke: '#000000',
                strokeThickness: 2
            });
            label.setOrigin(0.5);
            label.setScrollFactor(0);
            if (this.inventoryPanel) this.inventoryPanel.add(label);
            
            const value = this.add.text(statX, y + 60, stat.value, {
                fontSize: '22px',
                color: stat.color,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            value.setOrigin(0.5);
            value.setScrollFactor(0);
            if (this.inventoryPanel) this.inventoryPanel.add(value);
        });
    }
    
    // 显示物品详细信息
    private showItemDetails(item: GameItem, x: number, y: number) {
        // 如果已存在详情面板，先移除
        const existingDetail = (this as any).itemDetailPanel;
        if (existingDetail) {
            existingDetail.destroy();
        }
        
        // 创建详情面板容器
        const detailPanel = this.add.container(0, 0);
        detailPanel.setDepth(2100);
        
        // 计算面板位置（避免超出屏幕）
        const panelWidth = 300;
        const panelHeight = 250;
        const panelX = Math.min(x, this.cameras.main.width - panelWidth - 20);
        const panelY = Math.max(50, Math.min(y - 50, this.cameras.main.height - panelHeight - 20));
        
        // 背景
        const bg = this.add.graphics();
        bg.fillStyle(0xf39c12, 0.3);
        bg.fillRoundedRect(panelX - 3, panelY - 3, panelWidth + 6, panelHeight + 6, 12);
        bg.fillStyle(0x1a1a1a, 0.98);
        bg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        bg.lineStyle(3, 0xf39c12, 0.9);
        bg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
        bg.fillStyle(0xf39c12, 0.4);
        bg.fillRoundedRect(panelX, panelY, panelWidth, 40, 10);
        bg.setScrollFactor(0);
        detailPanel.add(bg);
        
        // 标题
        const title = this.add.text(panelX + panelWidth / 2, panelY + 20, item.name || this.getItemTypeName(item.type), {
            fontSize: '20px',
            color: '#f39c12',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        title.setOrigin(0.5);
        title.setScrollFactor(0);
        detailPanel.add(title);
        
        // 详细信息
        let detailY = panelY + 55;
        const lineHeight = 25;
        
        const details = [
            { label: '类型', value: this.getItemTypeName(item.type), color: '#3498db' },
            { label: '数量', value: `${item.quantity || 1}`, color: '#2ecc71' },
            { label: '价值', value: `$${item.value || 0}`, color: '#f1c40f' },
            { label: '重量', value: `${item.weight || 0} kg`, color: '#95a5a6' }
        ];
        
        // 添加特殊属性
        if (item.type === 'weapon' && item.subtype) {
            details.push({ label: '武器类型', value: item.subtype, color: '#e74c3c' });
        }
        if (item.type === 'ammo' && item.subtype) {
            details.push({ label: '弹药类型', value: item.subtype, color: '#e67e22' });
        }
        if (item.rarity) {
            const rarityNames = {
                common: '普通',
                uncommon: '不常见',
                rare: '稀有',
                epic: '史诗',
                legendary: '传说'
            };
            details.push({ label: '稀有度', value: rarityNames[item.rarity as keyof typeof rarityNames] || item.rarity, color: '#9b59b6' });
        }
        if (item.durability !== undefined && item.maxDurability) {
            details.push({ label: '耐久度', value: `${item.durability}/${item.maxDurability}`, color: '#1abc9c' });
        }
        
        details.forEach(detail => {
            if (detailY > panelY + panelHeight - 50) return;
            
            const detailText = this.add.text(panelX + 20, detailY, `${detail.label}:`, {
                fontSize: '14px',
                color: '#bdc3c7',
                stroke: '#000000',
                strokeThickness: 2
            });
            detailText.setScrollFactor(0);
            detailPanel.add(detailText);
            
            const valueText = this.add.text(panelX + panelWidth - 20, detailY, detail.value, {
                fontSize: '14px',
                color: detail.color,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            valueText.setOrigin(1, 0);
            valueText.setScrollFactor(0);
            detailPanel.add(valueText);
            
            detailY += lineHeight;
        });
        
        // 关闭按钮
        const closeButton = this.add.text(panelX + panelWidth / 2, panelY + panelHeight - 25, '[ 点击关闭 ]', {
            fontSize: '12px',
            color: '#95a5a6',
            stroke: '#000000',
            strokeThickness: 2
        });
        closeButton.setOrigin(0.5);
        closeButton.setScrollFactor(0);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerover', () => {
            closeButton.setColor('#ecf0f1');
        });
        closeButton.on('pointerout', () => {
            closeButton.setColor('#95a5a6');
        });
        closeButton.on('pointerdown', () => {
            detailPanel.destroy();
            (this as any).itemDetailPanel = null;
        });
        detailPanel.add(closeButton);
        
        // 添加到背包面板
        if (this.inventoryPanel) {
            this.inventoryPanel.add(detailPanel);
        }
        
        // 保存引用
        (this as any).itemDetailPanel = detailPanel;
    }
    
    // 关闭背包
    private closeInventory() {
        if (this.inventoryPanel) {
            this.inventoryPanel.destroy();
            this.inventoryPanel = undefined;
        }
        
        // 恢复游戏时的鼠标样式
        this.input.setDefaultCursor('none');
        
        // 恢复游戏
        this.physics.resume();
    }
    
    // 消灭敌人
    private killEnemy(enemy: any) {
        try {
            // 死亡特效
            const deathEffect = this.add.graphics();
            deathEffect.fillStyle(this.getEnemyAttackColor(enemy.type), 0.8);
            deathEffect.fillCircle(enemy.x, enemy.y, 30);
            deathEffect.setDepth(65);
            
            this.tweens.add({
                targets: deathEffect,
                scale: { from: 1, to: 2 },
                alpha: { from: 0.8, to: 0 },
                duration: 500,
                onComplete: () => deathEffect.destroy()
            });
            
            // 掉落金钱
            const moneyAmount = Phaser.Math.Between(10, 50);
            this.addGameItem(enemy.x, enemy.y, {
                type: 'money',
                value: moneyAmount
            });
            
            // 更新统计
            this.enemiesKilled++;
            
            // 移除敌人
            if (enemy.graphic) enemy.graphic.destroy();
            if (enemy.body) enemy.body.destroy();
            if (enemy.eyeGraphic) enemy.eyeGraphic.destroy();
            if (enemy.healthBarBg) enemy.healthBarBg.destroy();
            if (enemy.healthBar) enemy.healthBar.destroy();
            
            // 从数组中移除
            const index = this.enemies.indexOf(enemy);
            if (index > -1) {
                this.enemies.splice(index, 1);
            }
            
            // 随机掉落物品
            if (Math.random() < 0.35) { // 35%概率掉落物品，提高概率增加游戏体验
                // 根据敌人类型决定掉落物品池
                let itemTypes: Array<{type: string, subtype?: string, name?: string}>;
                
                // 普通敌人主要掉落弹药和基础医疗用品
                if (enemy.type === 'grunt') {
                    itemTypes = [
                        {type: 'medical', name: '小型医疗包'},
                        {type: 'ammo', subtype: 'pistol', name: '手枪弹药'},
                        {type: 'ammo', subtype: 'rifle', name: '步枪弹药'}
                    ];
                }
                // 精英敌人有机会掉落武器和更好的物品
                else if (enemy.type === 'soldier') {
                    itemTypes = [
                        {type: 'medical', name: '医疗包'},
                        {type: 'armor', name: '护甲片'},
                        {type: 'ammo', subtype: 'pistol', name: '手枪弹药'},
                        {type: 'ammo', subtype: 'rifle', name: '步枪弹药'},
                        {type: 'ammo', subtype: 'shotgun', name: '霰弹枪弹药'},
                        {type: 'weapon', subtype: 'rifle', name: '步枪'}
                    ];
                }
                // 队长敌人更容易掉落高级武器和弹药
                else {
                    itemTypes = [
                        {type: 'medical', name: '高级医疗包'},
                        {type: 'armor', name: '重型护甲片'},
                        {type: 'ammo', subtype: 'shotgun', name: '霰弹枪弹药'},
                        {type: 'ammo', subtype: 'sniper', name: '狙击枪弹药'},
                        {type: 'weapon', subtype: 'shotgun', name: '霰弹枪'},
                        {type: 'weapon', subtype: 'sniper', name: '狙击枪'}
                    ];
                }
                
                const randomItem = itemTypes[Phaser.Math.Between(0, itemTypes.length - 1)];
                this.addGameItem(enemy.x, enemy.y, randomItem);
            }
        } catch (error) {
            console.error('消灭敌人时出错:', error);
        }
    }
    
    // 添加单个游戏物品（用于动态生成，如敌人掉落）
    private addGameItem(x: number, y: number, itemData: {type: string, subtype?: string, name?: string, value?: number}) {
        try {
            // 创建物品定义对象
            const itemDef: any = {
                x: x,
                y: y,
                type: itemData.type,
                name: itemData.name,
                value: itemData.value || 1
            };
            
            // 如果有子类型，添加到定义中
            if (itemData.subtype) {
                itemDef.subtype = itemData.subtype;
            }
            
            // 生成唯一索引
            const index = this.items.length;
            
            // 使用现有的createGameItem方法创建物品
            const item = this.createGameItem(itemDef, index);
            
            // 如果物品创建成功，添加到物品数组
            if (item) {
                this.items.push(item);
                
                // 为掉落物品添加一个轻微的弹跳效果
                if (item.body) {
                    const bounceAngle = Math.random() * Math.PI * 2;
                    const bounceForce = 100 + Math.random() * 50;
                    item.body.setVelocity(
                        Math.cos(bounceAngle) * bounceForce,
                        Math.sin(bounceAngle) * bounceForce
                    );
                    
                    // 添加衰减的弹跳动画
                    this.tweens.add({
                        targets: item.body,
                        velocityX: 0,
                        velocityY: 0,
                        duration: 1000,
                        ease: 'Power2.easeOut'
                    });
                }
            }
        } catch (error) {
            console.error('添加单个游戏物品时出错:', error);
        }
    }
    
    // 激活随机撤离点
    private activateRandomEvacuationPoint() {
        try {
            if (this.evacuationPoints.length === 0) return;
            
            // 随机选择一个撤离点
            const inactivePoints = this.evacuationPoints.filter(p => !p.active);
            if (inactivePoints.length === 0) return;
            
            const randomIndex = Math.floor(Math.random() * inactivePoints.length);
            const evacPoint = inactivePoints[randomIndex];
            
            evacPoint.active = true;
            evacPoint.isCountdownActive = false;
            
            // 随机事件：某些撤离点可能需要特殊物品
            const needsSpecialItem = Math.random() < 0.3; // 30%概率需要特殊物品
            if (needsSpecialItem) {
                const specialItems = ['古代遗物', '金条', '电子元件'];
                const requiredItem = specialItems[Math.floor(Math.random() * specialItems.length)];
                evacPoint.requiredItems = [requiredItem];
                
                // 显示提示
                const hintText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2,
                    `⚠️ 撤离点需要特殊物品: ${requiredItem}`,
                    {
                        fontSize: '20px',
                        color: '#ffff00',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: { x: 15, y: 8 }
                    }
                );
                hintText.setOrigin(0.5);
                hintText.setScrollFactor(0);
                
                this.tweens.add({
                    targets: hintText,
                    alpha: { from: 1, to: 0 },
                    duration: 4000,
                    onComplete: () => hintText.destroy()
                });
            }
            
            this.evacuationAvailable = true;
            
            // 更新撤离点图形
            evacPoint.graphic.clear();
            evacPoint.graphic.fillStyle(0x00ff00, 0.5);
            evacPoint.graphic.fillCircle(0, 0, 30);
            evacPoint.graphic.lineStyle(3, 0x00ff00, 1);
            evacPoint.graphic.strokeCircle(0, 0, 30);
            
            // 显示撤离提示
            if (this.evacuationText) {
                this.evacuationText.setText(`撤离点已激活！前往坐标(${Math.floor(evacPoint.x)}, ${Math.floor(evacPoint.y)})`);
            }
            
            console.log(`撤离点已激活: (${evacPoint.x}, ${evacPoint.y})`);
            
        } catch (error) {
            console.error('激活撤离点时出错:', error);
        }
    }

    
    // 更新撤离点状态
    private updateEvacuationPoints(delta: number) {
        try {
            // 更新撤离点倒计时
            this.evacuationPoints.forEach(evacPoint => {
                if (evacPoint.active) {
                    // 如果正在倒计时，递减倒计时
                    if (evacPoint.isCountdownActive && evacPoint.countdown !== undefined) {
                        evacPoint.countdown -= delta / 1000; // delta是毫秒，转换为秒
                        if (evacPoint.countdown < 0) {
                            evacPoint.countdown = 0;
                        }
                    }
                    
                    // 随机事件：撤离点可能失效（0.5%概率每秒，只在玩家不在撤离点时）
                    if (!evacPoint.isCountdownActive && Math.random() < 0.005 * delta / 1000) {
                        const shouldFail = Math.random() < 0.15; // 15%概率失效
                        if (shouldFail) {
                            evacPoint.active = false;
                            evacPoint.graphic.clear();
                            evacPoint.graphic.fillStyle(0xff0000, 0.3);
                            evacPoint.graphic.fillCircle(0, 0, 30);
                            evacPoint.graphic.lineStyle(3, 0xff0000, 1);
                            evacPoint.graphic.strokeCircle(0, 0, 30);
                            
                            // 显示失效消息
                            const failText = this.add.text(
                                this.cameras.main.width / 2,
                                this.cameras.main.height / 2,
                                '⚠️ 撤离点失效！寻找其他撤离点',
                                {
                                    fontSize: '24px',
                                    color: '#ff0000',
                                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                    padding: { x: 20, y: 10 }
                                }
                            );
                            failText.setOrigin(0.5);
                            failText.setScrollFactor(0);
                            
                            this.tweens.add({
                                targets: failText,
                                alpha: { from: 1, to: 0 },
                                duration: 3000,
                                onComplete: () => {
                                    failText.destroy();
                                }
                            });
                            
                            // 3秒后激活另一个撤离点
                            this.time.delayedCall(3000, () => {
                                this.activateRandomEvacuationPoint();
                            });
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('更新撤离点状态时出错:', error);
        }
    }
    
    // 检查玩家是否在撤离点
    private checkEvacuationStatus() {
        try {
            if (!this.playerBody) return;
            
            this.evacuationPoints.forEach(evacPoint => {
                if (!evacPoint.active) return;
                
                const dist = Phaser.Math.Distance.Between(
                    this.playerBody.x, this.playerBody.y,
                    evacPoint.x, evacPoint.y
                );
                
                if (dist < 30) { // 在撤离点范围内
                    // 检查是否需要特殊物品
                    if (evacPoint.requiredItems && evacPoint.requiredItems.length > 0) {
                        const hasRequiredItems = evacPoint.requiredItems.every(itemName => 
                            this.playerBackpack.some(item => item.name === itemName)
                        );
                        
                        if (!hasRequiredItems) {
                            this.evacuationText?.setText(
                                `需要物品: ${evacPoint.requiredItems.join(', ')}\n距离: ${Math.floor(dist)}`
                            );
                            return;
                        }
                    }
                    
                    // 开始或继续倒计时
                    if (!evacPoint.isCountdownActive) {
                        evacPoint.isCountdownActive = true;
                        evacPoint.countdown = 10; // 10秒倒计时
                        
                        // 创建倒计时文本
                        if (!evacPoint.countdownText) {
                            evacPoint.countdownText = this.add.text(
                                evacPoint.x - this.cameras.main.scrollX,
                                evacPoint.y - this.cameras.main.scrollY - 50,
                                '',
                                {
                                    fontSize: '20px',
                                    color: '#00ff00',
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    padding: { x: 10, y: 5 }
                                }
                            );
                            evacPoint.countdownText.setOrigin(0.5);
                            evacPoint.countdownText.setScrollFactor(0);
                        }
                    }
                    
                    // 更新倒计时显示（在updateEvacuationPoints中处理递减）
                    if (evacPoint.countdown !== undefined && evacPoint.countdownText) {
                        if (evacPoint.countdown > 0) {
                        evacPoint.countdownText.setText(`撤离倒计时: ${Math.ceil(evacPoint.countdown)}秒`);
                        evacPoint.countdownText.setPosition(
                            evacPoint.x - this.cameras.main.scrollX,
                            evacPoint.y - this.cameras.main.scrollY - 50
                        );
                            this.evacuationText?.setText(`正在撤离... ${Math.ceil(evacPoint.countdown)}秒`);
                        } else {
                            // 倒计时结束，自动撤离
                            evacPoint.countdownText?.setText('撤离成功！');
                            this.completeEvacuation();
                        }
                    }
                } else {
                    // 离开撤离点，重置倒计时
                    if (evacPoint.isCountdownActive) {
                        evacPoint.isCountdownActive = false;
                        evacPoint.countdown = undefined;
                        if (evacPoint.countdownText) {
                            evacPoint.countdownText.setVisible(false);
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('检查撤离状态时出错:', error);
        }
    }
    
    // 游戏结束
    private gameOver(isVictory: boolean) {
        try {
            this.gameStarted = false;
            this.physics.pause(); // 暂停物理系统
            
            let gameOverText;
            let finalScore = this.playerMoney;
            
            if (isVictory) {
                gameOverText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2,
                    `胜利！
成功撤离！
获得金钱: $${finalScore}
收集物品: ${this.collectedItems}
游戏时间: ${Math.floor(this.gameTime)}秒`,
                    {
                        fontSize: '32px',
                        color: '#00ff00',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { x: 30, y: 20 },
                        align: 'center'
                    }
                );
            } else {
                gameOverText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2,
                    `游戏结束！
你已死亡
获得金钱: $${finalScore}
收集物品: ${this.collectedItems}
游戏时间: ${Math.floor(this.gameTime)}秒`,
                    {
                        fontSize: '32px',
                        color: '#ff0000',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { x: 30, y: 20 },
                        align: 'center'
                    }
                );
            }
            
            gameOverText.setOrigin(0.5);
            gameOverText.setScrollFactor(0);
            gameOverText.setDepth(3000);
            
            // 显示重新开始提示
            const restartText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2 + 150,
                '按R键重新开始',
                {
                    fontSize: '24px',
                    color: '#ffffff',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: { x: 20, y: 10 }
                }
            );
            
            restartText.setOrigin(0.5);
            restartText.setScrollFactor(0);
            restartText.setDepth(3000);
            
            // 监听R键重新开始（完全重置）
            this.input.keyboard?.once('keydown-R', () => {
                // 清理所有敌人
                this.enemies.forEach(enemy => {
                    if (enemy) {
                        enemy.graphic?.destroy();
                        enemy.eyeGraphic?.destroy();
                        enemy.healthBar?.destroy();
                        enemy.healthBarBg?.destroy();
                        enemy.body?.destroy();
                    }
                });
                this.enemies = [];
                
                // 清理所有物品
                this.items.forEach(item => {
                    if (item) {
                        item.graphic?.destroy();
                        item.body?.destroy();
                    }
                });
                this.items = [];
                
                // 重置玩家状态
                this.playerHealth = this.playerMaxHealth;
                this.playerArmor = 0;
                this.playerMoney = 0;
                this.collectedItems = 0;
                this.gameTime = 0;
                
                // 重启场景
                this.scene.restart();
            });
            
        } catch (error) {
            console.error('游戏结束处理时出错:', error);
        }
    }
}