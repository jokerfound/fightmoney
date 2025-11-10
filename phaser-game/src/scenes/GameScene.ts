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
    dropTime?: number; // 掉落时间（用于防止立即拾取）
    pickupHint?: Phaser.GameObjects.Text | null; // 拾取提示文本
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
    graphic: Phaser.GameObjects.Graphics; // 中心标记图形
    zoneGraphic?: Phaser.GameObjects.Graphics; // 撤离区域图形（大圆圈）
    labelText?: Phaser.GameObjects.Text; // 标签文本
    countdownRing?: Phaser.GameObjects.Graphics; // 倒计时圆环
    radius: number; // 撤离区域半径
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
    private playerSpeed: number = 240;
    private basePlayerSpeed: number = 240; // 基础移动速度（适中的速度）
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
    private nearbyItem: GameItem | null = null; // 玩家附近的物品
    private pickupHintText: Phaser.GameObjects.Text | null = null; // 拾取提示文本
    private eKeyJustPressed: boolean = false; // E键是否刚按下（防止重复触发）

    
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
    
    // 武器系统
    private weapons: Weapon[] = [];
    private backgroundMusic?: Phaser.Sound.BaseSound; // 背景音乐
    private audioContext?: AudioContext; // 共享的AudioContext，避免频繁创建
    
    // 信息面板
    private infoPanel?: Phaser.GameObjects.Container; // 物品信息面板

    
    // 存储从仓库传入的装备信息
    private equippedWeapon: string = '手枪';
    private equippedArmor: number = 0;
    private equippedMaxHealth: number = 100;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: any) {
        // 从传入数据或 localStorage 读取装备信息
        if (data) {
            this.equippedWeapon = data.currentWeapon || localStorage.getItem('player_current_weapon') || '手枪';
            this.equippedArmor = data.playerArmor !== undefined ? data.playerArmor : (parseInt(localStorage.getItem('player_armor') || '0', 10));
            this.equippedMaxHealth = data.playerMaxHealth !== undefined ? data.playerMaxHealth : (parseInt(localStorage.getItem('player_max_health') || '100', 10));
        } else {
            // 如果没有传入数据，从 localStorage 读取
            this.equippedWeapon = localStorage.getItem('player_current_weapon') || '手枪';
            this.equippedArmor = parseInt(localStorage.getItem('player_armor') || '0', 10);
            this.equippedMaxHealth = parseInt(localStorage.getItem('player_max_health') || '100', 10);
        }
        
        console.log(`游戏初始化 - 装备武器: ${this.equippedWeapon}, 护甲: ${this.equippedArmor}, 最大生命值: ${this.equippedMaxHealth}`);
    }

    create() {
        console.log('GameScene 创建完成');
        
        try {
            // 初始化玩家数据（确保初始值正确）
            this.initializePlayerData();
            
            // 确保相机可见
            this.cameras.main.setAlpha(1);
            this.cameras.main.setVisible(true);
            
            // 设置背景色（几乎黑色，让房间颜色更突出）
            this.cameras.main.setBackgroundColor(0x000000);
            
            // 先设置相机边界，确保地图能正确显示（扩大地图后的尺寸）
            this.cameras.main.setBounds(0, 0, 12000, 9000);
            
            // 确保相机正确初始化
            this.cameras.main.setScroll(0, 0);
            
            // 初始化物理系统
            if (!this.physics) {
                console.error('物理系统初始化失败');
                return;
            }
            
            // 优化物理世界设置，提升流畅度
            this.physics.world.setFPS(60); // 物理更新频率与游戏帧率一致（60 FPS）
            this.physics.world.timeScale = 1.0; // 确保时间缩放为1.0
            
            // 性能优化：禁用世界边界碰撞检测，减少不必要的计算
            this.physics.world.setBoundsCollision(false, false, false, false);
            
            // 优化碰撞检测性能
            this.physics.world.setBounds(0, 0, 12000, 9000);
            
            // 初始化共享的AudioContext（提前创建，避免首次使用时延迟和卡顿）
            this.getAudioContext();
            
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
            
            // 注意：相机设置在 createPlayer() 内部延迟调用，避免重复设置
            
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
    
    // 初始化玩家数据（确保初始值正确）
    private initializePlayerData() {
        try {
            // 清除错误的数据，重置为初始值
            // 初始生命值：满血100
            this.playerMaxHealth = 100;
            this.playerHealth = 100; // 满血开始
            
            // 初始护甲：0（未装备）
            this.playerArmor = 0;
            
            // 保存到localStorage（确保持久化）
            localStorage.setItem('player_health', this.playerHealth.toString());
            localStorage.setItem('player_max_health', this.playerMaxHealth.toString());
            localStorage.setItem('player_armor', this.playerArmor.toString());
            localStorage.removeItem('player_equipped_armor'); // 清除护甲装备记录
            
            // 确保初始资金为1000（如果没有保存数据或为0）
            const savedMoney = localStorage.getItem('player_money');
            if (!savedMoney || parseInt(savedMoney, 10) === 0) {
                this.playerMoney = 1000;
                localStorage.setItem('player_money', '1000');
            } else {
                this.playerMoney = parseInt(savedMoney, 10);
            }
            
            console.log(`玩家数据初始化: 生命值=${this.playerHealth}/${this.playerMaxHealth}, 护甲=${this.playerArmor}, 金钱=$${this.playerMoney}`);
        } catch (error) {
            console.warn('初始化玩家数据时出错:', error);
            // 如果出错，设置为初始值
            this.playerHealth = 100;
            this.playerMaxHealth = 100;
            this.playerArmor = 0;
            this.playerMoney = 1000;
        }
    }
    
    update(_time: number, delta: number) {
        try {
            if (!this.gameStarted) return;
            
            // 性能优化：严格限制delta值避免帧率波动影响（60 FPS = 16.67ms）
            const clampedDelta = Math.min(delta, 33); // 最多33ms，允许30FPS下限，确保流畅度
            
            // 确保相机跟随玩家（如果还没设置）
            if (this.playerBody && this.cameras.main && !(this.cameras.main as any)._followTarget) {
                this.setupCamera();
            }
            
            // 更新游戏时间
            this.gameTime += delta / 1000;
            
            // 更新十字准星位置（高性能，每帧更新）
            if ((this as any)._updateCrosshair) {
                (this as any)._updateCrosshair();
            }
            
            // 性能优化：大幅减少HUD更新频率（每30帧更新一次，约2次/秒）
            if (!(this as any).frameCount) (this as any).frameCount = 0;
            (this as any).frameCount++;
            
            if ((this as any).frameCount % 30 === 0) {
                this.timerText?.setText(`⏱ 时间: ${Math.floor(this.gameTime)}s`);
                this.updateHUD();
            }
            
            // 更新玩家移动（使用clampedDelta以获得更精确的移动）
            this.updatePlayerMovement(clampedDelta);
            
            // 同步玩家图形位置（直接使用物理体位置，避免延迟）
            if (this.playerBody && this.player) {
                this.playerX = this.playerBody.x;
                this.playerY = this.playerBody.y;
                this.player.setPosition(this.playerX, this.playerY);
                if ((this as any).playerGlowGraphic) {
                    (this as any).playerGlowGraphic.setPosition(this.playerX, this.playerY);
                }
            }
            
            // 十字准星位置由原生DOM事件直接更新，不经过update循环
            
            // 性能优化：大幅降低更新频率以减少卡顿
            // 更新敌人AI（降低频率以提升性能，每5帧更新一次）
            if ((this as any).frameCount % 5 === 0) {
                this.updateEnemies(clampedDelta);
            }
            
            // 性能优化：进一步减少检查频率
            if ((this as any).frameCount % 8 === 0) {
                this.checkItemCollection();
            }
            
            if ((this as any).frameCount % 15 === 0) {
                this.checkEvacuationStatus();
                this.checkInteractiveObjects();
            }
            
            // 更新撤离点状态（提高频率以确保倒计时准确）
            if ((this as any).frameCount % 3 === 0) {
                this.updateEvacuationPoints(clampedDelta);
            }
            
            // 检查撤离点开关交互（进一步降低频率）
            if ((this as any).frameCount % 20 === 0) {
                this.checkEvacuationSwitch();
            }
            
            // 更新小地图（大幅降低频率）
            if ((this as any).frameCount % 60 === 0) {
                this.updateMiniMap();
            }
            
            // 处理可破坏物体（降低频率）
            if ((this as any).frameCount % 10 === 0) {
                this.updateDestructibleObjects();
            }
            
            // 更新门的状态（降低频率）
            if ((this as any).frameCount % 15 === 0) {
                this.updateDoors();
            }
            
            // 更新动画效果（降低频率）
            if ((this as any).frameCount % 6 === 0) {
                this.updateAnimations();
            }
            
            // 处理TAB键打开/关闭背包
            if (this.keys && (this.keys as any).tab && Phaser.Input.Keyboard.JustDown((this.keys as any).tab)) {
                this.toggleInventory();
            }
            
            // 更新武器后坐力衰减
            this.weapons.forEach(weapon => {
                weapon.updateRecoil(clampedDelta);
            });
            
            // 处理连续射击（使用世界坐标）
            // 手枪只能点射，其他武器支持全自动连射
            if ((this as any).isShooting && this.playerBody) {
                const now = this.time.now;
                const weaponIndex = (this as any).currentWeaponIndex || 0;
                const weapon = this.weapons[weaponIndex];
                
                // 手枪（索引0）只能点射，不支持连射
                // 其他武器支持连射
                if (weapon && weaponIndex !== 0) {
                    // 非手枪武器：支持连射
                    if (now - (this as any).lastShootTime >= weapon.fireRate) {
                        const pointer = this.input.activePointer;
                        this.shoot(pointer.worldX, pointer.worldY);
                        (this as any).lastShootTime = now;
                    }
                }
                // 手枪会在pointerdown事件中单次射击，这里不处理
            }
            
        } catch (error) {
            console.error('游戏更新错误:', error);
        }
    }
    
    // 重新设计的地图创建系统 - 确保所有元素尺寸一致，无错位
    private createSimpleMap() {
        try {
            // 设置统一的网格单元大小（保持不变，确保物品、人物、敌人大小不变）
            const gridSize = 80; // 使用单一统一的网格尺寸
            
            // 设置世界边界，扩大地图尺寸（约1.5倍）
            const worldWidth = 12000;
            const worldHeight = 9000;
            this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
            
            // 设置输入区域为整个地图范围
            this.input.setTopOnly(false);
            
            // 创建交互对象组
            this.interactiveObjects = this.physics.add.group();
            this.destructibleObjects = this.physics.add.group();
            this.doors = this.physics.add.group();
            
            // 创建背景网格，使用与地图相同的尺寸（在对象组之后）
            this.createBackground(worldWidth, worldHeight, gridSize);
            
            // 定义房间系统 - 扩大房间尺寸和间距（约1.5倍，保持物品等大小不变）
            const rooms = [
                { x: 15, y: 15, width: 15, height: 12, type: 'start', color: 0x4A6FA5, name: '起始区域' },
                { x: 36, y: 15, width: 18, height: 15, type: 'main', color: 0x5D4037, name: '中央大厅' },
                { x: 15, y: 33, width: 12, height: 9, type: 'side', color: 0x3E4C59, name: '左侧仓库' },
                { x: 60, y: 15, width: 12, height: 12, type: 'side', color: 0x3E4C59, name: '右侧军械库' },
                { x: 36, y: 36, width: 15, height: 12, type: 'treasure', color: 0x6D4C41, name: '宝藏室' },
                { x: 57, y: 33, width: 12, height: 9, type: 'evac', color: 0x2E7D32, name: '撤离点' },
                { x: 75, y: 22, width: 7, height: 7, type: 'side', color: 0x3E4C59, name: '观察点' },
                { x: 36, y: 7, width: 12, height: 6, type: 'side', color: 0x3E4C59, name: '补给站' }
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
            
            // 确保相机初始位置正确（在起始房间，使用扩大后的房间尺寸）
            const startRoomX = 15 * gridSize;
            const startRoomY = 15 * gridSize;
            const startRoomW = 15 * gridSize;
            const startRoomH = 12 * gridSize;
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
    private getDoorwayPositions(roomX: number, roomY: number, _roomWidth: number, _roomHeight: number): {side: string, pos: number}[] {
        const doorways: {side: string, pos: number}[] = [];
        
        // 根据房间位置和走廊定义，确定门口位置
        // 走廊定义和对应的门口位置：
        
        // 起始房间 (15, 15, 15, 12) - 扩大后的房间
        if (roomX === 15 && roomY === 15) {
            // 右侧，连接中央大厅（相对位置调整）
            doorways.push({side: 'right', pos: 4}); // 右侧中间位置
            // 底部，连接左侧仓库（相对位置调整）
            doorways.push({side: 'bottom', pos: 7}); // 底部偏左
        }
        
        // 中央大厅 (36, 15, 18, 15) - 扩大后的房间
        if (roomX === 36 && roomY === 15) {
            // 左侧，连接起始房间
            doorways.push({side: 'left', pos: 4}); // 左侧中间位置
            // 右侧，连接右侧房间
            doorways.push({side: 'right', pos: 4}); // 右侧中间位置
            // 底部，连接宝藏房间
            doorways.push({side: 'bottom', pos: 9}); // 底部中间位置
            // 顶部，连接补给站
            doorways.push({side: 'top', pos: 9}); // 顶部中间位置
        }
        
        
        // 右侧房间 (60, 15, 12, 12) - 扩大后的房间
        if (roomX === 60 && roomY === 15) {
            // 左侧，连接中央大厅
            doorways.push({side: 'left', pos: 4}); // 左侧中间位置
            // 底部，连接观察点区域
            doorways.push({side: 'bottom', pos: 6}); // 底部中间位置
        }
        
        // 宝藏房间 (36, 36, 15, 12) - 扩大后的房间
        if (roomX === 36 && roomY === 36) {
            // 顶部，连接中央大厅
            doorways.push({side: 'top', pos: 7}); // 顶部中间位置
            // 右侧，连接撤离点
            doorways.push({side: 'right', pos: 3}); // 右侧偏上
        }
        
        // 撤离点房间 (57, 33, 12, 9) - 扩大后的房间
        if (roomX === 57 && roomY === 33) {
            // 左侧，连接宝藏房间
            doorways.push({side: 'left', pos: 4}); // 左侧中间位置
        }
        
        // 左侧仓库 (15, 33, 12, 9) - 扩大后的房间
        if (roomX === 15 && roomY === 33) {
            // 顶部，连接起始房间
            doorways.push({side: 'top', pos: 4}); // 顶部中间位置
            // 右侧，连接中央大厅附近
            doorways.push({side: 'right', pos: 4}); // 右侧中间位置
            // 底部，连接宝藏房间
            doorways.push({side: 'bottom', pos: 6}); // 底部中间位置
        }
        
        // 观察点 (75, 22, 7, 7) - 扩大后的房间
        if (roomX === 75 && roomY === 22) {
            // 左侧，连接右侧军械库
            doorways.push({side: 'left', pos: 3}); // 左侧中间位置
        }
        
        // 补给站 (36, 7, 12, 6) - 扩大后的房间
        if (roomX === 36 && roomY === 7) {
            // 底部，连接中央大厅
            doorways.push({side: 'bottom', pos: 6}); // 底部中间位置
        }
        
        return doorways;
    }
    
    // 为房间创建墙壁 - 接受网格尺寸参数，支持门口（旧版本，保留作为备份）
    private createRoomWalls(x: number, y: number, width: number, height: number, color: number, gridSize: number) {
        // 使用传入的网格尺寸，确保墙壁与地图其他元素对齐
        
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
                sideDoorways.forEach((doorway) => {
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
                    // 起始区域 - 优化后的办公家具布局（减少数量提升性能）
                    // 中央会议区域（减少到1张桌子和2把椅子）
                    this.addTable(roomX + roomW/2, roomY + roomH/2 - 40);
                    this.addChair(roomX + roomW/2 - 50, roomY + roomH/2 - 20);
                    this.addChair(roomX + roomW/2 + 50, roomY + roomH/2 - 20);
                    
                    // 左侧工作区域（1张电脑桌和椅子）
                    this.addTable(roomX + 120, roomY + 200);
                    this.addComputer(roomX + 120, roomY + 200);
                    this.addChair(roomX + 120, roomY + 260);
                    
                    // 右侧工作区域（1张电脑桌和椅子）
                    this.addTable(roomX + roomW - 120, roomY + 200);
                    this.addComputer(roomX + roomW - 120, roomY + 200);
                    this.addChair(roomX + roomW - 120, roomY + 260);
                    
                    // 底部区域（减少文件柜数量）
                    this.addFileCabinet(roomX + 120, roomY + roomH - 60);
                    this.addStorageBox(roomX + roomW/2, roomY + roomH - 60);
                    this.addFileCabinet(roomX + roomW - 120, roomY + roomH - 60);
                    
                    // 顶部区域（只保留白板）
                    this.addWhiteboard(roomX + roomW/2, roomY + 60);
                    
                    // 角落装饰（只保留1个植物）
                    this.addPlant(roomX + 60, roomY + roomH - 60);
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
    }
    
    // 添加文件柜 - 精美的办公家具设计
    private addFileCabinet(x: number, y: number) {
        const cabinet = this.add.graphics();
        
        // 文件柜阴影
        cabinet.fillStyle(0x2a2a2a, 0.6);
        cabinet.fillEllipse(0, 25, 35, 12);
        
        // 文件柜主体（3D效果）
        cabinet.fillStyle(0x34495e, 1);
        cabinet.fillRoundedRect(-18, -35, 36, 55, 3);
        
        // 顶部高光
        cabinet.fillStyle(0x5d6d7e, 1);
        cabinet.fillRoundedRect(-18, -35, 36, 12, 3);
        
        // 侧面阴影（3D效果）
        cabinet.fillStyle(0x2c3e50, 1);
        cabinet.fillRoundedRect(-18, -23, 8, 43, 2);
        
        // 抽屉分隔线（模拟多个抽屉）
        cabinet.lineStyle(2, 0x2c3e50, 1);
        for (let i = 0; i < 3; i++) {
            const drawerY = -35 + (i + 1) * 18;
            cabinet.beginPath();
            cabinet.moveTo(-18, drawerY);
            cabinet.lineTo(18, drawerY);
            cabinet.strokePath();
        }
        
        // 抽屉把手（金属）
        for (let i = 0; i < 3; i++) {
            const handleY = -26 + i * 18;
            cabinet.fillStyle(0x7f8c8d, 1);
            cabinet.fillRoundedRect(8, handleY, 8, 3, 1);
            cabinet.lineStyle(1, 0x95a5a6, 1);
            cabinet.strokeRoundedRect(8, handleY, 8, 3, 1);
            
            // 把手高光
            cabinet.fillStyle(0x95a5a6, 0.8);
            cabinet.fillRoundedRect(9, handleY + 1, 6, 1, 0.5);
        }
        
        // 边框
        cabinet.lineStyle(2, 0x2c3e50, 1);
        cabinet.strokeRoundedRect(-18, -35, 36, 55, 3);
        
        cabinet.setPosition(x, y);
        cabinet.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(36, 55);
        body.setImmovable(true);
        body.setDepth(52);
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
    }
    
    // 添加白板 - 精美的办公白板设计
    private addWhiteboard(x: number, y: number) {
        const board = this.add.graphics();
        
        // 白板阴影
        board.fillStyle(0x2a2a2a, 0.5);
        board.fillEllipse(0, 15, 120, 20);
        
        // 白板主体（3D效果）
        board.fillStyle(0xf8f9fa, 1);
        board.fillRoundedRect(-60, -40, 120, 80, 4);
        
        // 白板边框（金属）
        board.lineStyle(4, 0x34495e, 1);
        board.strokeRoundedRect(-60, -40, 120, 80, 4);
        
        // 内边框（装饰）
        board.lineStyle(2, 0x95a5a6, 0.6);
        board.strokeRoundedRect(-55, -35, 110, 70, 3);
        
        // 模拟白板上的标记（彩色笔迹）
        const markers = [
            { x: -40, y: -20, color: 0x3498db }, // 蓝色
            { x: -20, y: -10, color: 0xe74c3c }, // 红色
            { x: 0, y: 0, color: 0x2ecc71 },     // 绿色
            { x: 20, y: 10, color: 0xf39c12 },   // 橙色
            { x: 40, y: 20, color: 0x9b59b6 }   // 紫色
        ];
        
        markers.forEach(marker => {
            board.fillStyle(marker.color, 0.6);
            board.fillCircle(marker.x, marker.y, 3);
        });
        
        // 模拟文字线条
        board.lineStyle(2, 0x34495e, 0.4);
        board.beginPath();
        board.moveTo(-50, -15);
        board.lineTo(50, -15);
        board.moveTo(-50, 0);
        board.lineTo(30, 0);
        board.moveTo(-50, 15);
        board.lineTo(40, 15);
        board.strokePath();
        
        // 顶部挂架（金属）
        board.fillStyle(0x34495e, 1);
        board.fillRoundedRect(-65, -45, 130, 8, 2);
        board.lineStyle(2, 0x2c3e50, 1);
        board.strokeRoundedRect(-65, -45, 130, 8, 2);
        
        // 挂架装饰（金属扣件）
        board.fillStyle(0x7f8c8d, 1);
        board.fillCircle(-55, -41, 2);
        board.fillCircle(55, -41, 2);
        
        board.setPosition(x, y);
        board.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(120, 80);
        body.setImmovable(true);
        body.setDepth(52);
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
    }
    
    // 添加植物 - 精美的装饰植物设计
    private addPlant(x: number, y: number) {
        const plant = this.add.graphics();
        
        // 花盆阴影
        plant.fillStyle(0x2a2a2a, 0.5);
        plant.fillEllipse(0, 18, 30, 10);
        
        // 花盆主体（3D效果）
        plant.fillStyle(0x8B4513, 1);
        plant.fillRoundedRect(-12, 8, 24, 20, 3);
        
        // 花盆顶部高光
        plant.fillStyle(0x9B5533, 1);
        plant.fillRoundedRect(-12, 8, 24, 6, 3);
        
        // 花盆侧面阴影
        plant.fillStyle(0x6B3513, 1);
        plant.fillRoundedRect(-12, 14, 6, 14, 2);
        
        // 花盆边框
        plant.lineStyle(2, 0x654321, 1);
        plant.strokeRoundedRect(-12, 8, 24, 20, 3);
        
        // 花盆装饰线
        plant.lineStyle(1, 0x7B5533, 0.6);
        plant.beginPath();
        plant.moveTo(-8, 12);
        plant.lineTo(8, 12);
        plant.moveTo(-6, 16);
        plant.lineTo(6, 16);
        plant.strokePath();
        
        // 植物叶子（多层次）
        // 底层叶子（深绿色）- 使用椭圆近似
        plant.fillStyle(0x27ae60, 1);
        plant.fillEllipse(-8, -5, 16, 24);
        plant.fillEllipse(8, -5, 16, 24);
        
        // 中层叶子（中绿色）
        plant.fillStyle(0x2ecc71, 1);
        plant.fillEllipse(-5, -8, 12, 20);
        plant.fillEllipse(5, -8, 12, 20);
        plant.fillEllipse(0, -10, 14, 22);
        
        // 顶层叶子（亮绿色）
        plant.fillStyle(0x58d68d, 1);
        plant.fillEllipse(-3, -12, 10, 16);
        plant.fillEllipse(3, -12, 10, 16);
        plant.fillEllipse(0, -14, 12, 18);
        
        // 叶子纹理（叶脉）
        plant.lineStyle(1, 0x1e8449, 0.6);
        plant.beginPath();
        plant.moveTo(-8, -5);
        plant.lineTo(-8, -15);
        plant.moveTo(8, -5);
        plant.lineTo(8, -15);
        plant.moveTo(0, -10);
        plant.lineTo(0, -20);
        plant.strokePath();
        
        // 植物中心（茎）
        plant.fillStyle(0x1e8449, 1);
        plant.fillRect(-1, 8, 2, 10);
        
        plant.setPosition(x, y);
        plant.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(24, 28);
        body.setImmovable(true);
        body.setDepth(52);
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
    }
    

    
    // 环境效果方法（预留，未来可能使用）
    // 这些方法已预留但当前未使用，保留以备将来扩展
    
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
    private createOuterWalls(rooms: any[], _corridors: any[], gridSize: number) {
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
            
            // 创建开关图形（更大更明显）
            const switchGraphic = this.add.graphics();
            
            // 外圈发光效果（脉冲动画用）
            const glowGraphic = this.add.graphics();
            glowGraphic.setPosition(switchX, switchY);
            glowGraphic.setDepth(44);
            
            // 开关主体（红色，表示未激活）- 增大尺寸
            switchGraphic.fillStyle(0xff0000, 0.9);
            switchGraphic.fillRect(-40, -40, 80, 80);
            switchGraphic.lineStyle(6, 0xffffff, 1);
            switchGraphic.strokeRect(-40, -40, 80, 80);
            // 内层发光边框
            switchGraphic.lineStyle(3, 0xffaa00, 0.8);
            switchGraphic.strokeRect(-38, -38, 76, 76);
            
            // 开关按钮（更大）
            switchGraphic.fillStyle(0x333333, 1);
            switchGraphic.fillRect(-20, -20, 40, 40);
            switchGraphic.lineStyle(3, 0xffffff, 1);
            switchGraphic.strokeRect(-20, -20, 40, 40);
            // 按钮内部高光
            switchGraphic.fillStyle(0x666666, 0.5);
            switchGraphic.fillRect(-18, -18, 36, 36);
            
            // 添加发光脉冲动画
            this.tweens.add({
                targets: glowGraphic,
                alpha: { from: 0.3, to: 0.8 },
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    glowGraphic.clear();
                    const alpha = glowGraphic.alpha;
                    glowGraphic.fillStyle(0xff0000, alpha * 0.3);
                    glowGraphic.fillCircle(0, 0, 50);
                    glowGraphic.lineStyle(4, 0xffaa00, alpha * 0.6);
                    glowGraphic.strokeCircle(0, 0, 50);
                }
            });
            
            // 添加开关文字（更大更明显）
            const switchText = this.add.text(0, 0, '撤离点开关', {
                fontSize: '20px',
                color: '#ffffff',
                backgroundColor: 'rgba(255, 0, 0, 0.9)',
                padding: { left: 10, right: 10, top: 5, bottom: 5 },
                stroke: '#ffff00',
                strokeThickness: 2
            });
            switchText.setOrigin(0.5);
            switchText.setDepth(46);
            switchText.setVisible(false);
            
            // 添加提示图标（大感叹号）
            const iconText = this.add.text(0, 0, '⚠', {
                fontSize: '48px',
                color: '#ffaa00'
            });
            iconText.setOrigin(0.5);
            iconText.setDepth(46);
            
            switchGraphic.setPosition(switchX, switchY);
            switchGraphic.setDepth(45);
            
            // 创建物理碰撞体用于交互检测（增大检测范围）
            const switchBody = this.interactiveObjects.create(switchX, switchY, '');
            if (switchBody && switchBody.body) {
                const body = switchBody.body as Phaser.Physics.Arcade.Body;
                body.setSize(100, 100); // 增大检测范围
                body.setOffset(-50, -50);
                body.setImmovable(true);
            }
            
            // 存储开关数据
            switchBody.setData('type', 'evacuationSwitch');
            switchBody.setData('name', '撤离点开关');
            switchBody.setData('graphic', switchGraphic);
            switchBody.setData('glowGraphic', glowGraphic);
            switchBody.setData('text', switchText);
            switchBody.setData('iconText', iconText);
            switchBody.setData('active', true);
            switchBody.setData('activated', false);
            switchBody.setData('priority', 999); // 设置最高优先级，确保优先检测
            
            this.evacuationSwitch = switchBody;
            
            console.log(`撤离点开关创建完成: 位置(${switchX}, ${switchY}), 检测范围: 100x100`);
            
        } catch (error) {
            console.error('创建撤离点开关时出错:', error);
        }
    }
    
    // 检查撤离点开关交互（优先检测，确保不被其他对象干扰）
    private checkEvacuationSwitch() {
        try {
            if (!this.playerBody || !this.evacuationSwitch) return;
            
            const switchBody = this.evacuationSwitch;
            if (!switchBody.active || switchBody.getData('activated')) return;
            
            const distance = Phaser.Math.Distance.Between(
                this.playerBody.x, this.playerBody.y,
                switchBody.x, switchBody.y
            );
            
            const interactionDistance = 120; // 增大交互距离
            const graphic = switchBody.getData('graphic');
            const glowGraphic = switchBody.getData('glowGraphic');
            const switchText = switchBody.getData('text');
            const iconText = switchBody.getData('iconText');
            
            if (distance < interactionDistance) {
                // 玩家接近开关，显示提示
                if (switchText) {
                    switchText.setText('撤离点开关\n【按E键激活】');
                    switchText.setVisible(true);
                    switchText.setPosition(
                        switchBody.x - this.cameras.main.scrollX,
                        switchBody.y - this.cameras.main.scrollY - 80
                    );
                    switchText.setScrollFactor(0);
                }
                
                if (iconText) {
                    iconText.setPosition(
                        switchBody.x - this.cameras.main.scrollX,
                        switchBody.y - this.cameras.main.scrollY - 50
                    );
                    iconText.setScrollFactor(0);
                    iconText.setVisible(true);
                }
                
                // 高亮效果（增强）
                if (graphic && !switchBody.getData('isHighlighted')) {
                    switchBody.setData('isHighlighted', true);
                    graphic.clear();
                    // 外层高亮
                    graphic.fillStyle(0xff6600, 0.95);
                    graphic.fillRect(-40, -40, 80, 80);
                    graphic.lineStyle(6, 0xffff00, 1);
                    graphic.strokeRect(-40, -40, 80, 80);
                    graphic.lineStyle(4, 0xffffff, 0.9);
                    graphic.strokeRect(-38, -38, 76, 76);
                    // 按钮
                    graphic.fillStyle(0xffff00, 0.8);
                    graphic.fillRect(-20, -20, 40, 40);
                    graphic.lineStyle(3, 0xffffff, 1);
                    graphic.strokeRect(-20, -20, 40, 40);
                }
                
                // 增强发光效果
                if (glowGraphic) {
                    glowGraphic.setAlpha(1);
                }
                
                // 检测E键按下（使用justDown确保只触发一次）
                const eKey = (this.keys as any)?.e;
                if (eKey && Phaser.Input.Keyboard.JustDown(eKey)) {
                    console.log('检测到E键按下，激活撤离开关');
                    this.activateEvacuationSwitch();
                }
            } else {
                // 玩家远离开关
                if (switchText) {
                    switchText.setVisible(false);
                }
                
                if (iconText) {
                    iconText.setVisible(false);
                }
                
                // 恢复原始外观
                if (graphic && switchBody.getData('isHighlighted')) {
                    switchBody.setData('isHighlighted', false);
                    if (!switchBody.getData('activated')) {
                        graphic.clear();
                        // 恢复原始红色外观（更大）
                        graphic.fillStyle(0xff0000, 0.9);
                        graphic.fillRect(-40, -40, 80, 80);
                        graphic.lineStyle(6, 0xffffff, 1);
                        graphic.strokeRect(-40, -40, 80, 80);
                        graphic.lineStyle(3, 0xffaa00, 0.8);
                        graphic.strokeRect(-38, -38, 76, 76);
                        // 按钮
                        graphic.fillStyle(0x333333, 1);
                        graphic.fillRect(-20, -20, 40, 40);
                        graphic.lineStyle(3, 0xffffff, 1);
                        graphic.strokeRect(-20, -20, 40, 40);
                        graphic.fillStyle(0x666666, 0.5);
                        graphic.fillRect(-18, -18, 36, 36);
                    }
                }
                
                if (glowGraphic) {
                    // 恢复脉冲动画
                    glowGraphic.setAlpha(0.5);
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
            
            // 更新开关外观（绿色，表示已激活）- 更大更明显
            if (graphic) {
                graphic.clear();
                // 外层绿色
                graphic.fillStyle(0x00ff00, 0.95);
                graphic.fillRect(-40, -40, 80, 80);
                graphic.lineStyle(6, 0xffffff, 1);
                graphic.strokeRect(-40, -40, 80, 80);
                graphic.lineStyle(4, 0x00ff00, 0.9);
                graphic.strokeRect(-38, -38, 76, 76);
                // 按钮
                graphic.fillStyle(0x00ff00, 1);
                graphic.fillRect(-20, -20, 40, 40);
                graphic.lineStyle(3, 0xffffff, 1);
                graphic.strokeRect(-20, -20, 40, 40);
                // 按钮高光
                graphic.fillStyle(0x88ff88, 0.6);
                graphic.fillRect(-18, -18, 36, 36);
            }
            
            // 更新发光效果为绿色
            const glowGraphic = switchBody.getData('glowGraphic');
            if (glowGraphic) {
                this.tweens.killTweensOf(glowGraphic);
                this.tweens.add({
                    targets: glowGraphic,
                    alpha: { from: 0.4, to: 0.9 },
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                    onUpdate: () => {
                        glowGraphic.clear();
                        const alpha = glowGraphic.alpha;
                        glowGraphic.fillStyle(0x00ff00, alpha * 0.3);
                        glowGraphic.fillCircle(0, 0, 50);
                        glowGraphic.lineStyle(4, 0x00ff00, alpha * 0.8);
                        glowGraphic.strokeCircle(0, 0, 50);
                    }
                });
            }
            
            if (switchText) {
                switchText.setText('撤离开关\n✓ 已激活');
                switchText.setVisible(true);
                switchText.setStyle({
                    backgroundColor: 'rgba(0, 255, 0, 0.9)',
                    color: '#000000'
                });
            }
            
            const iconText = switchBody.getData('iconText');
            if (iconText) {
                iconText.setText('✓');
                iconText.setColor('#00ff00');
            }
            
            switchBody.setData('activated', true);
            
            // 在撤离点房间开启门口
            this.openEvacuationRoomDoorway();
            
            // 激活撤离点房间内的撤离点
            const gridSize = 80;
            // 使用正确的撤离点房间坐标（与房间定义一致）
            const evacRoom = { x: 57, y: 33, width: 12, height: 9 };
            const evacCenterX = (evacRoom.x + evacRoom.width / 2) * gridSize;
            const evacCenterY = (evacRoom.y + evacRoom.height / 2) * gridSize;
            
            // 找到并激活撤离点房间内的撤离点
            console.log(`激活撤离点：撤离点房间中心(${evacCenterX}, ${evacCenterY})`);
            console.log(`当前撤离点数量: ${this.evacuationPoints.length}`);
            
            let activatedCount = 0;
            this.evacuationPoints.forEach((evacPoint, index) => {
                const dist = Phaser.Math.Distance.Between(
                    evacPoint.x, evacPoint.y,
                    evacCenterX, evacCenterY
                );
                // 如果撤离点在撤离点房间内（距离中心小于房间尺寸的一半）
                // 使用更宽松的判断，确保房间内的撤离点能被激活
                const roomMaxSize = Math.max(evacRoom.width, evacRoom.height) * gridSize;
                const threshold = roomMaxSize * 0.8;
                console.log(`撤离点${index}: 位置(${evacPoint.x}, ${evacPoint.y}), 距离=${Math.floor(dist)}, 阈值=${Math.floor(threshold)}`);
                if (dist < threshold) {
                    console.log(`✓ 激活撤离点${index}，位置在撤离点房间内`);
                    evacPoint.active = true;
                    evacPoint.isCountdownActive = false;
                    activatedCount++;
                    
                    // 更新撤离区域图形为激活状态（绿色）
                    if (evacPoint.zoneGraphic) {
                        evacPoint.zoneGraphic.setVisible(true);
                        evacPoint.zoneGraphic.clear();
                        evacPoint.zoneGraphic.fillStyle(0x00ff00, 0.15); // 激活时绿色
                        evacPoint.zoneGraphic.fillCircle(0, 0, evacPoint.radius);
                        evacPoint.zoneGraphic.lineStyle(4, 0x00ff00, 0.6); // 激活时绿色
                        evacPoint.zoneGraphic.strokeCircle(0, 0, evacPoint.radius);
                        evacPoint.zoneGraphic.setAlpha(1); // 激活时完全不透明
                        // 添加脉冲动画效果
                        this.tweens.add({
                            targets: evacPoint.zoneGraphic,
                            alpha: { from: 0.3, to: 0.6 },
                            duration: 1000,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                    
                    // 更新撤离点中心标记为激活状态（绿色）
                    if (evacPoint.graphic) {
                        evacPoint.graphic.setVisible(true);
                        evacPoint.graphic.clear();
                        evacPoint.graphic.fillStyle(0x00ff00, 0.5); // 激活时绿色
                        evacPoint.graphic.fillCircle(0, 0, 20);
                        evacPoint.graphic.lineStyle(3, 0x00ff00, 1); // 激活时绿色
                        evacPoint.graphic.strokeCircle(0, 0, 20);
                        evacPoint.graphic.lineStyle(3, 0xffffff, 1);
                        evacPoint.graphic.lineBetween(-15, 0, 15, 0);
                        evacPoint.graphic.lineBetween(0, -15, 0, 15);
                        // 添加旋转动画效果
                        this.tweens.add({
                            targets: evacPoint.graphic,
                            rotation: { from: 0, to: Math.PI * 2 },
                            duration: 2000,
                            repeat: -1,
                            ease: 'Linear'
                        });
                    }
                    
                    // 更新标签为激活状态（但隐藏，只在接近时显示）
                    if (evacPoint.labelText) {
                        evacPoint.labelText.setText('撤离点');
                        evacPoint.labelText.setColor('#00ff00'); // 激活时绿色
                        evacPoint.labelText.setVisible(false); // 激活后隐藏，不一直显示
                    }
                } else {
                    console.log(`✗ 撤离点${index}不在撤离点房间内，距离太远`);
                }
            });
            
            // 如果没有激活任何撤离点，强制激活所有撤离点（即使距离稍远）
            if (activatedCount === 0) {
                console.warn('没有撤离点被激活，强制激活所有撤离点');
                this.evacuationPoints.forEach((evacPoint) => {
                    evacPoint.active = true;
                    evacPoint.isCountdownActive = false;
                    activatedCount++;
                    
                    // 更新撤离区域图形为激活状态
                    if (evacPoint.zoneGraphic) {
                        evacPoint.zoneGraphic.clear();
                        evacPoint.zoneGraphic.fillStyle(0x00ff00, 0.15);
                        evacPoint.zoneGraphic.fillCircle(0, 0, evacPoint.radius);
                        evacPoint.zoneGraphic.lineStyle(4, 0x00ff00, 0.6);
                        evacPoint.zoneGraphic.strokeCircle(0, 0, evacPoint.radius);
                        evacPoint.zoneGraphic.setAlpha(1);
                        this.tweens.add({
                            targets: evacPoint.zoneGraphic,
                            alpha: { from: 0.3, to: 0.6 },
                            duration: 1000,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                    
                    // 更新中心标记为激活状态
                    if (evacPoint.graphic) {
                        evacPoint.graphic.clear();
                        evacPoint.graphic.fillStyle(0x00ff00, 0.5);
                        evacPoint.graphic.fillCircle(0, 0, 20);
                        evacPoint.graphic.lineStyle(3, 0x00ff00, 1);
                        evacPoint.graphic.strokeCircle(0, 0, 20);
                        evacPoint.graphic.lineStyle(3, 0xffffff, 1);
                        evacPoint.graphic.lineBetween(-15, 0, 15, 0);
                        evacPoint.graphic.lineBetween(0, -15, 0, 15);
                        this.tweens.add({
                            targets: evacPoint.graphic,
                            rotation: { from: 0, to: Math.PI * 2 },
                            duration: 2000,
                            repeat: -1,
                            ease: 'Linear'
                        });
                    }
                    
                    // 更新标签（但隐藏，不一直显示）
                    if (evacPoint.labelText) {
                        evacPoint.labelText.setText('撤离点');
                        evacPoint.labelText.setColor('#00ff00');
                        evacPoint.labelText.setVisible(false); // 隐藏标签
                    }
                });
            }
            
            // 如果没有任何撤离点，创建一个
            if (this.evacuationPoints.length === 0) {
                console.warn('没有找到撤离点，强制创建一个');
                const zoneGraphic = this.add.graphics();
                zoneGraphic.fillStyle(0x00ff00, 0.15);
                zoneGraphic.fillCircle(0, 0, 120);
                zoneGraphic.lineStyle(4, 0x00ff00, 0.6);
                zoneGraphic.strokeCircle(0, 0, 120);
                zoneGraphic.setPosition(evacCenterX, evacCenterY);
                zoneGraphic.setDepth(39);
                zoneGraphic.setVisible(true);
                
                const graphic = this.add.graphics();
                graphic.fillStyle(0x00ff00, 0.5);
                graphic.fillCircle(0, 0, 20);
                graphic.lineStyle(3, 0x00ff00, 1);
                graphic.strokeCircle(0, 0, 20);
                graphic.lineStyle(3, 0xffffff, 1);
                graphic.lineBetween(-15, 0, 15, 0);
                graphic.lineBetween(0, -15, 0, 15);
                graphic.setPosition(evacCenterX, evacCenterY);
                graphic.setDepth(40);
                graphic.setVisible(true);
                
                const labelText = this.add.text(
                    evacCenterX,
                    evacCenterY - 150,
                    '撤离点',
                    {
                        fontSize: '18px',
                        color: '#00ff00',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        padding: { left: 10, right: 10, top: 5, bottom: 5 },
                        align: 'center'
                    }
                );
                labelText.setOrigin(0.5);
                labelText.setDepth(50);
                labelText.setVisible(true);
                
                const evacPoint: EvacuationPoint = {
                    x: evacCenterX,
                    y: evacCenterY,
                    graphic,
                    zoneGraphic,
                    labelText,
                    radius: 120,
                    active: true,
                    isCountdownActive: false
                };
                
                this.evacuationPoints.push(evacPoint);
                activatedCount++;
            }
            
            console.log(`成功激活 ${activatedCount} 个撤离点`);
            
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
            // 使用正确的撤离点房间坐标（与房间定义一致）
            const evacRoom = { x: 57, y: 33, width: 12, height: 9 };
            
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
    // 添加储物箱 - 精美的金属箱设计
    private addStorageBox(x: number, y: number) {
        const box = this.add.graphics();
        
        // 箱子阴影
        box.fillStyle(0x2a2a2a, 0.6);
        box.fillEllipse(0, 12, 38, 12);
        
        // 箱子主体 - 3D金属箱效果
        box.fillStyle(0x4a4a4a, 1); // 深灰色金属
        box.fillRoundedRect(-15, -10, 30, 20, 3);
        
        // 顶部高光（金属反光效果）
        box.fillStyle(0x6a6a6a, 1);
        box.fillRoundedRect(-15, -10, 30, 8, 3);
        
        // 侧面阴影（3D效果）
        box.fillStyle(0x3a3a3a, 1);
        box.fillRoundedRect(-15, -2, 8, 12, 2);
        
        // 金属边框
        box.lineStyle(2, 0x2c3e50, 1);
        box.strokeRoundedRect(-15, -10, 30, 20, 3);
        
        // 内部分割线（储物格效果）
        box.lineStyle(1, 0x34495e, 0.6);
        box.beginPath();
        box.moveTo(-5, -10);
        box.lineTo(-5, 10);
        box.moveTo(5, -10);
        box.lineTo(5, 10);
        box.moveTo(-15, 0);
        box.lineTo(15, 0);
        box.strokePath();
        
        // 金属扣件（四角）
        box.fillStyle(0x7f8c8d, 1);
        box.fillCircle(-12, -7, 2.5);
        box.fillCircle(12, -7, 2.5);
        box.fillCircle(-12, 7, 2.5);
        box.fillCircle(12, 7, 2.5);
        
        // 扣件高光
        box.fillStyle(0x95a5a6, 0.8);
        box.fillCircle(-12, -7, 1.5);
        box.fillCircle(12, -7, 1.5);
        box.fillCircle(-12, 7, 1.5);
        box.fillCircle(12, 7, 1.5);
        
        // 顶部标签区域
        box.fillStyle(0x34495e, 1);
        box.fillRoundedRect(-12, -12, 24, 5, 2);
        
        // 标签文字区域（模拟）
        box.fillStyle(0x2c3e50, 1);
        box.fillRoundedRect(-10, -11, 20, 3, 1);
        
        // 锁孔（中心）
        box.fillStyle(0x1a1a1a, 1);
        box.fillCircle(0, 0, 2);
        box.lineStyle(1, 0x555555, 1);
        box.strokeCircle(0, 0, 2);
        
        box.setPosition(x, y);
        box.setDepth(52);
        
        // 添加物理碰撞
        const body = this.physics.add.sprite(x, y, '');
        body.setSize(30, 20);
        body.setImmovable(true);
        body.setDepth(52);
        body.setVisible(false); // 隐藏物理碰撞体的方块显示
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
            // 扩大后的起始房间：x: 15, y: 15, width: 15, height: 12, gridSize: 80
            // 房间中心 = (x + width/2) * gridSize, (y + height/2) * gridSize
            const gridSize = 80;
            const startRoomX = 15;
            const startRoomY = 15;
            const startRoomW = 15;
            const startRoomH = 12;
            this.playerX = (startRoomX + startRoomW / 2) * gridSize; // (15 + 7.5) * 80 = 1800
            this.playerY = (startRoomY + startRoomH / 2) * gridSize; // (15 + 6) * 80 = 1680
            
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
                if (this.cameras.main && this.playerBody) {
                    // 确保相机可见
                    this.cameras.main.setAlpha(1);
                    this.cameras.main.setVisible(true);
                    
                    // 设置相机跟随
                    this.setupCamera();
                    
                    // 确保相机立即在玩家位置
                    this.cameras.main.centerOn(this.playerBody.x, this.playerBody.y);
                    
                    console.log('相机已设置到玩家位置:', this.playerBody.x, this.playerBody.y);
                } else {
                    console.error('相机或玩家物理体未初始化');
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
                    time - lastEmitTime > 200) {
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
                
                // 添加H键用于快速使用医疗物品
                (this.keys as any).h = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
                
                // 设置E键监听（用于撤离开关交互）
                this.input.keyboard.on('keydown-E', () => {
                    // E键按下处理已整合到 checkEvacuationSwitch 方法中
                });
                
                // 设置H键监听（快速使用医疗物品）
                this.input.keyboard.on('keydown-H', () => {
                    this.useMedicalItem();
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
            
            // 创建更精致的玩家状态面板（左上角，缩小尺寸避免遮挡）
            const panelX = 10;
            const panelY = 10;
            const panelWidth = 260; // 缩小宽度
            const panelHeight = 180; // 缩小高度
            
            const statusPanelBg = this.add.graphics();
            // 外层发光边框
            statusPanelBg.fillStyle(0x3498db, 0.2);
            statusPanelBg.fillRoundedRect(panelX - 3, panelY - 3, panelWidth + 6, panelHeight + 6, 12);
            // 主背景
            statusPanelBg.fillStyle(0x0a0a0a, 0.85);
            statusPanelBg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
            // 内层高光
            statusPanelBg.lineStyle(2, 0x3498db, 0.6);
            statusPanelBg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
            // 顶部装饰条
            statusPanelBg.fillStyle(0x3498db, 0.3);
            statusPanelBg.fillRoundedRect(panelX, panelY, panelWidth, 30, 10);
            statusPanelBg.setScrollFactor(0);
            statusPanelBg.setDepth(1000);
            
            // 标题 - 更精致的样式
            const titleText = this.add.text(panelX + panelWidth / 2, panelY + 8, '⚔ 玩家状态', {
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            titleText.setOrigin(0.5, 0);
            titleText.setScrollFactor(0);
            titleText.setDepth(1001);
            
            // 时间显示 - 添加图标（紧凑布局）
            this.timerText = this.add.text(panelX + 15, panelY + 38, '⏱ 0s', { 
                fontSize: '13px', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.timerText.setScrollFactor(0);
            this.timerText.setDepth(1001);
            
            // 金钱显示 - 添加图标和阴影（紧凑布局）
            this.moneyText = this.add.text(panelX + 15, panelY + 58, '💰 $0', { 
                fontSize: '13px', 
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2,
                fontStyle: 'bold'
            });
            this.moneyText.setScrollFactor(0);
            this.moneyText.setDepth(1001);
            
            // 击杀数显示 - 添加图标（紧凑布局）
            (this as any).killsText = this.add.text(panelX + 15, panelY + 78, '💀 0', {
                fontSize: '13px',
                color: '#ff6b6b',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).killsText.setScrollFactor(0);
            (this as any).killsText.setDepth(1001);
            
            // 生命值标签和数值 - 改进样式（紧凑布局）
            this.add.text(panelX + 15, panelY + 100, '❤ 生命值', { 
                fontSize: '12px', 
                color: '#ff6b6b',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setScrollFactor(0).setDepth(1001);
            
            (this as any).healthText = this.add.text(panelX + panelWidth - 15, panelY + 100, '100/100', {
                fontSize: '12px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).healthText.setOrigin(1, 0);
            (this as any).healthText.setScrollFactor(0);
            (this as any).healthText.setDepth(1001);
            
            // 创建健康条背景 - 更精致的设计（紧凑布局）
            const healthBarBg = this.add.graphics();
            healthBarBg.fillStyle(0x000000, 0.6);
            healthBarBg.fillRoundedRect(panelX + 13, panelY + 118, panelWidth - 26, 18, 9);
            healthBarBg.lineStyle(1, 0x666666, 0.5);
            healthBarBg.strokeRoundedRect(panelX + 13, panelY + 118, panelWidth - 26, 18, 9);
            healthBarBg.setScrollFactor(0);
            healthBarBg.setDepth(1000);
            
            // 创建健康条 - 添加渐变效果
            this.playerHealthBar = this.add.graphics();
            this.playerHealthBar.setScrollFactor(0);
            this.playerHealthBar.setDepth(1001);
            
            // 护甲标签和数值（紧凑布局）
            this.add.text(panelX + 15, panelY + 142, '🛡 护甲', { 
                fontSize: '12px', 
                color: '#3498db',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setScrollFactor(0).setDepth(1001);
            
            (this as any).armorText = this.add.text(panelX + panelWidth - 15, panelY + 142, '0/100', {
                fontSize: '12px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            (this as any).armorText.setOrigin(1, 0);
            (this as any).armorText.setScrollFactor(0);
            (this as any).armorText.setDepth(1001);
            
            // 创建护甲条背景（紧凑布局）
            const armorBarBg = this.add.graphics();
            armorBarBg.fillStyle(0x000000, 0.6);
            armorBarBg.fillRoundedRect(panelX + 13, panelY + 158, panelWidth - 26, 14, 7);
            armorBarBg.lineStyle(1, 0x666666, 0.5);
            armorBarBg.strokeRoundedRect(panelX + 13, panelY + 158, panelWidth - 26, 14, 7);
            armorBarBg.setScrollFactor(0);
            armorBarBg.setDepth(1000);
            
            // 创建护甲条
            this.playerArmorBar = this.add.graphics();
            this.playerArmorBar.setScrollFactor(0);
            this.playerArmorBar.setDepth(1001);
            
            // 创建中央提示区域（顶部中央，缩小尺寸避免遮挡）
            const notificationBg = this.add.graphics();
            const notifWidth = 350; // 缩小宽度
            const notifHeight = 40; // 缩小高度
            // 外层发光
            notificationBg.fillStyle(0x2ecc71, 0.15);
            notificationBg.fillRoundedRect(width/2 - notifWidth/2 - 3, 5, notifWidth + 6, notifHeight + 6, 10);
            // 主背景
            notificationBg.fillStyle(0x0a0a0a, 0.8);
            notificationBg.fillRoundedRect(width/2 - notifWidth/2, 8, notifWidth, notifHeight, 8);
            // 渐变顶部条
            notificationBg.fillStyle(0x2ecc71, 0.3);
            notificationBg.fillRoundedRect(width/2 - notifWidth/2, 8, notifWidth, 6, 8);
            // 边框
            notificationBg.lineStyle(2, 0x2ecc71, 0.6);
            notificationBg.strokeRoundedRect(width/2 - notifWidth/2, 8, notifWidth, notifHeight, 8);
            notificationBg.setScrollFactor(0);
            notificationBg.setDepth(1000);
            
            // 创建撤离提示文本
            this.evacuationText = this.add.text(
                width / 2, 
                28, 
                '', 
                {
                    fontSize: '16px',
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
    
    // 根据稀有度获取护甲值
    private getArmorValueByRarity(rarity: ItemRarity): number {
        switch (rarity) {
            case ItemRarity.LEGENDARY:
                return 100; // 传说护甲：100点
            case ItemRarity.EPIC:
                return 75;  // 史诗护甲：75点
            case ItemRarity.RARE:
                return 55;  // 稀有护甲：55点
            case ItemRarity.UNCOMMON:
                return 25;  // 不常见护甲：25点
            case ItemRarity.COMMON:
            default:
                return 10;  // 普通护甲：10点（烂甲）
        }
    }
    
    // 初始化武器系统
    private initWeapons() {
        try {
            // 清空现有武器
            this.weapons = [];
            
            // 四种武器类型，根据真实武器特点设计
            this.weapons.push(
                // 1. 手枪 - 基础武器，平衡型
                new Weapon({
                    name: '手枪',
                    damage: 20,           // 中等伤害
                    fireRate: 400,        // 中等射速（可半自动连射）
                    range: 600,          // 中近距离
                    bulletSpeed: 700,    // 中等弹速
                    ammoCapacity: 15,     // 中等弹容量
                    bulletSize: 4,       // 小口径子弹
                    color: 0xaaaaaa,     // 灰色
                    ammoType: 'pistol',
                    precision: 0.80,     // 80%精度（中等精度）
                    recoil: 0.04         // 较小后坐力
                }),
                // 2. 步枪 - 主力武器，支持全自动连射
                new Weapon({
                    name: '步枪',
                    damage: 30,           // 较高伤害
                    fireRate: 150,        // 高射速（全自动连射）
                    range: 1000,         // 中远距离
                    bulletSpeed: 900,    // 高弹速
                    ammoCapacity: 30,     // 大弹容量
                    bulletSize: 5,       // 中口径子弹
                    color: 0x00ff00,     // 绿色
                    ammoType: 'rifle',
                    precision: 0.70,     // 70%精度（连射时精度下降）
                    recoil: 0.10         // 中等后坐力（连射时累积）
                }),
                // 3. 霰弹枪 - 近距离高伤害，散射
                new Weapon({
                    name: '霰弹枪',
                    damage: 50,           // 高伤害（单发总伤害）
                    fireRate: 800,        // 低射速（单发装填）
                    range: 400,          // 近距离
                    bulletSpeed: 600,    // 较低弹速
                    ammoCapacity: 7,      // 小弹容量（7发）
                    bulletSize: 6,       // 大口径
                    color: 0xff7700,     // 橙色
                    ammoType: 'shotgun',
                    precision: 0.50,     // 50%精度（散射武器）
                    recoil: 0.15,        // 大后坐力
                    spread: 20           // 20度扩散（多发弹丸）
                }),
                // 4. 狙击枪 - 远距离高精度，单发高伤害
                new Weapon({
                    name: '狙击枪',
                    damage: 100,          // 极高伤害
                    fireRate: 1200,       // 极低射速（单发装填）
                    range: 2500,         // 超远距离
                    bulletSpeed: 1500,   // 极高弹速
                    ammoCapacity: 5,      // 极小弹容量
                    bulletSize: 8,       // 超大口径
                    color: 0x0000ff,     // 蓝色
                    ammoType: 'sniper',
                    precision: 0.95,     // 95%精度（极高精度）
                    recoil: 0.20         // 极大后坐力（但单发，恢复快）
                })
            );
            
            // 根据装备的武器设置初始武器索引
            const weaponNameToIndex: { [key: string]: number } = {
                '手枪': 0,
                '步枪': 1,
                '霰弹枪': 2,
                '狙击枪': 3
            };
            
            const initialWeaponIndex = weaponNameToIndex[this.equippedWeapon] || 0;
            (this as any).currentWeaponIndex = initialWeaponIndex;
            
            console.log(`根据装备设置初始武器: ${this.equippedWeapon} (索引: ${initialWeaponIndex})`);
            
            // 设置初始弹药（测试模式）
            // 手枪：100发备弹
            this.weapons[0].reserveAmmo = 100;
            
            // 步枪：只有初始弹匣30发，没有备弹
            this.weapons[1].reserveAmmo = 0;
            this.weapons[1].currentAmmo = 30; // 确保初始弹匣满弹
            
            // 霰弹枪：只有初始弹匣7发，没有备弹
            this.weapons[2].reserveAmmo = 0;
            this.weapons[2].currentAmmo = 7; // 确保初始弹匣满弹
            
            // 狙击枪：只有初始弹匣5发，没有备弹
            this.weapons[3].reserveAmmo = 0;
            this.weapons[3].currentAmmo = 5; // 确保初始弹匣满弹
            
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
            const controlText = this.add.text(30, this.cameras.main.height - 45, '🎮 [ 鼠标左键 ] 射击  [ 鼠标右键 ] 查看信息  [ R ] 换弹  [ 1-4 ] 切换武器  [ TAB ] 背包', {
                fontSize: '12px',
                color: '#95a5a6',
                stroke: '#000000',
                strokeThickness: 2
            });
            controlText.setScrollFactor(0);
            controlText.setDepth(1001);
            
            // 添加武器切换功能（四种武器：1-手枪, 2-步枪, 3-霰弹枪, 4-狙击枪）
            this.input.keyboard?.on('keydown-1', () => this.switchWeapon(0)); // 手枪
            this.input.keyboard?.on('keydown-2', () => this.switchWeapon(1)); // 步枪
            this.input.keyboard?.on('keydown-3', () => this.switchWeapon(2)); // 霰弹枪
            this.input.keyboard?.on('keydown-4', () => this.switchWeapon(3)); // 狙击枪
            
            // 添加换弹功能
            this.input.keyboard?.on('keydown-R', () => this.reload());
            
            // 更新显示
            this.updateWeaponDisplay();
            
        } catch (error) {
            console.error('初始化武器系统时出错:', error);
        }
    }
    
    // 切换武器（测试模式：允许随时切换）
    private switchWeapon(index: number) {
        try {
            if (index >= 0 && index < this.weapons.length) {
                const weapon = this.weapons[index];
                
                // 测试模式：允许随时切换武器（即使没有弹药也可以切换，但无法射击）
                (this as any).currentWeaponIndex = index;
                this.updateWeaponDisplay();
                
                // 检查武器是否有弹药
                const hasAmmo = weapon.currentAmmo > 0 || weapon.reserveAmmo > 0;
                
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
                
                // 如果没有弹药，显示提示
                if (!hasAmmo && index !== 0) {
                    const noAmmoText = this.add.text(
                        this.cameras.main.width / 2,
                        this.cameras.main.height / 2 + 50,
                        `⚠️ ${weapon.name} 没有弹药！`,
                        {
                            fontSize: '18px',
                            color: '#f39c12',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: { x: 15, y: 8 }
                        }
                    );
                    noAmmoText.setOrigin(0.5);
                    noAmmoText.setScrollFactor(0);
                    noAmmoText.setDepth(3000);
                    
                    this.tweens.add({
                        targets: noAmmoText,
                        alpha: { from: 1, to: 0 },
                        y: noAmmoText.y - 20,
                        duration: 1500,
                        onComplete: () => noAmmoText.destroy()
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
            
            // 检查是否需要换弹（即使没有子弹也显示动画）
            if (weapon.isReloading) {
                // 正在换弹中，不重复触发
                return;
            }
            
            // 检查是否有备用弹药（如果没有备用弹药，仍然显示动画但显示提示）
            const hasAmmo = weapon.reserveAmmo > 0;
            
            // 检查是否有子弹（当前弹夹和备用弹药）
            const hasAnyAmmo = weapon.currentAmmo > 0 || hasAmmo;
            
            if (!hasAnyAmmo) {
                // 没有任何子弹，显示提示但不换弹
                this.showNotification('没有子弹！', '#ff0000');
                return; // 直接返回，不进行换弹倒计时
            }
            
            if (!hasAmmo) {
                this.showNotification('没有备用弹药！', '#ff0000');
                // 即使没有备弹，如果有当前弹药，也允许换弹动画（用于反馈）
            }
            
            // 即使弹夹已满，也允许显示换弹动画（用于反馈）
            if (weapon.currentAmmo >= weapon.ammoCapacity && hasAmmo) {
                this.showNotification('弹夹已满', '#00ff00');
                // 仍然显示动画，但不真正换弹
            }
            
            // 开始换弹（无论是否有子弹，都显示动画）
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
            
            // 创建圆环动画 - 围绕玩家位置（跟随玩家移动）
            // 使用更平滑的更新频率（每50ms更新一次，约20fps，足够流畅且减少卡顿）
            let lastUpdateTime = 0;
            
            this.tweens.addCounter({
                from: 0,
                to: 360,
                duration: 2500, // 2.5秒
                onUpdate: (tween) => {
                    // 性能优化：降低重绘频率（每50ms更新一次，约20fps，减少卡顿）
                    const now = this.time.now;
                    if (now - lastUpdateTime < 50) return;
                    lastUpdateTime = now;
                    
                    const tweenValue = tween.getValue();
                    currentAngle = tweenValue !== null ? tweenValue : 0;
                    
                    // 实时获取玩家当前屏幕坐标（跟随玩家移动）
                    let screenX: number;
                    let screenY: number;
                    
                    if (this.playerBody && this.playerBody.body) {
                        const worldX = this.playerBody.x;
                        const worldY = this.playerBody.y;
                        // 将世界坐标转换为屏幕坐标（实时更新）
                        screenX = worldX - this.cameras.main.scrollX;
                        screenY = worldY - this.cameras.main.scrollY;
                    } else {
                        // 备用：使用玩家位置变量
                        screenX = this.playerX - this.cameras.main.scrollX;
                        screenY = this.playerY - this.cameras.main.scrollY;
                    }
                    
                    // 清除并重绘（美化版）
                    reloadRing.clear();
                    
                    // 绘制外圈发光效果
                    reloadRing.fillStyle(0xffff00, 0.1);
                    reloadRing.fillCircle(screenX, screenY, ringRadius + 8);
                    
                    // 绘制背景圆环（深灰色，带阴影效果）
                    reloadRing.lineStyle(8, 0x222222, 0.6);
                    reloadRing.beginPath();
                    reloadRing.arc(screenX, screenY, ringRadius, 0, Phaser.Math.DegToRad(360), false);
                    reloadRing.strokePath();
                    
                    // 绘制内层背景圆环（更亮的灰色）
                    reloadRing.lineStyle(6, 0x444444, 0.4);
                    reloadRing.beginPath();
                    reloadRing.arc(screenX, screenY, ringRadius - 2, 0, Phaser.Math.DegToRad(360), false);
                    reloadRing.strokePath();
                    
                    // 绘制进度圆环（黄色渐变，逐渐减少）
                    const remainingAngle = 360 - currentAngle;
                    if (remainingAngle > 0) {
                        // 外层进度圆环（粗，半透明）
                        reloadRing.lineStyle(8, 0xffff00, 0.5);
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
                        
                        // 内层进度圆环（细，高亮）
                        reloadRing.lineStyle(6, 0xffff00, 1);
                        reloadRing.beginPath();
                        reloadRing.arc(
                            screenX, 
                            screenY, 
                            ringRadius - 2, 
                            Phaser.Math.DegToRad(-90), 
                            Phaser.Math.DegToRad(-90 + remainingAngle), 
                            false
                        );
                        reloadRing.strokePath();
                        
                        // 进度端点高光
                        const endRad = Phaser.Math.DegToRad(-90 + remainingAngle);
                        const endX = screenX + Math.cos(endRad) * ringRadius;
                        const endY = screenY + Math.sin(endRad) * ringRadius;
                        reloadRing.fillStyle(0xffffff, 1);
                        reloadRing.fillCircle(endX, endY, 4);
                        reloadRing.fillStyle(0xffff00, 1);
                        reloadRing.fillCircle(endX, endY, 2);
                    }
                },
                onComplete: () => {
                    reloadRing.destroy();
                }
            });
            
            // 设置setScrollFactor(0)让圆环使用屏幕坐标（因为我们已经在计算屏幕坐标）
            reloadRing.setScrollFactor(0);
            
            // 播放换弹音效
            this.playReloadSound();
            
            // 2.5秒后完成换弹
            this.time.delayedCall(2500, () => {
                if (!weapon) return;
                
                // 计算需要的弹药量（只有有备用弹药时才装填）
                if (weapon.reserveAmmo > 0) {
                    const ammoNeeded = weapon.ammoCapacity - weapon.currentAmmo;
                    const ammoToLoad = Math.min(ammoNeeded, weapon.reserveAmmo);
                    
                    // 更新弹药
                    weapon.currentAmmo += ammoToLoad;
                    weapon.reserveAmmo -= ammoToLoad;
                    
                    console.log(`换弹完成：装填 ${ammoToLoad} 发弹药`);
                } else {
                    // 没有备用弹药，换弹失败
                    console.log('换弹失败：没有备用弹药');
                }
                
                weapon.isReloading = false;
                
                // 更新显示
                this.updateWeaponDisplay();
                
                // 显示完成提示（只有成功换弹才显示）
                if (weapon.reserveAmmo > 0 || weapon.currentAmmo > 0) {
                    const completeText = this.add.text(
                        this.cameras.main.width / 2,
                        this.cameras.main.height / 2 - 50,
                        weapon.reserveAmmo > 0 ? '换弹完成！' : '换弹完成（无备用弹药）',
                        {
                            fontSize: '24px',
                            color: weapon.reserveAmmo > 0 ? '#00ff00' : '#ffaa00',
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
                }
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
                const panelX = 10;
                const panelY = 10;
                const panelWidth = 260;
                const barWidth = (panelWidth - 26) * healthPercent;
                
                // 根据生命值百分比改变颜色
                let healthColor = 0x2ecc71; // 绿色
                if (healthPercent < 0.3) {
                    healthColor = 0xe74c3c; // 红色
                } else if (healthPercent < 0.6) {
                    healthColor = 0xf39c12; // 橙色
                }
                
                // 绘制健康条 - 添加圆角和内发光效果（使用新的面板位置）
                this.playerHealthBar.fillStyle(healthColor, 1);
                this.playerHealthBar.fillRoundedRect(panelX + 13, panelY + 118, barWidth, 18, 9);
                
                // 添加高光效果
                this.playerHealthBar.fillStyle(0xffffff, 0.3);
                this.playerHealthBar.fillRoundedRect(panelX + 13, panelY + 118, barWidth, 6, 3);
            }
            
            // 更新护甲
            if ((this as any).armorText) {
                (this as any).armorText.setText(`${Math.ceil(this.playerArmor)}/100`);
            }
            
            if (this.playerArmorBar) {
                this.playerArmorBar.clear();
                const armorPercent = this.playerArmor / 100;
                const panelX = 10;
                const panelY = 10;
                const panelWidth = 260;
                const armorWidth = (panelWidth - 26) * armorPercent;
                
                // 绘制护甲条 - 添加圆角和光泽效果（使用新的面板位置）
                this.playerArmorBar.fillStyle(0x3498db, 1);
                this.playerArmorBar.fillRoundedRect(panelX + 13, panelY + 158, armorWidth, 14, 7);
                
                // 添加高光效果
                this.playerArmorBar.fillStyle(0xffffff, 0.3);
                this.playerArmorBar.fillRoundedRect(panelX + 13, panelY + 158, armorWidth, 4, 2);
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
                camera.setBounds(0, 0, 12000, 9000); 
                
                // 优化相机跟随，使用更平滑的插值（提升流畅度）
                // lerp值越小，跟随越平滑（0.05-0.08 提供更流畅的跟随）
                camera.startFollow(this.playerBody, true, 0.05, 0.05);
                
                // 设置相机跟随的偏移（让玩家在屏幕中心偏上一点）
                camera.setFollowOffset(0, -50);
                
                // 设置死亡区域（玩家在区域内移动时相机不移动）
                camera.setDeadzone(200, 150);
                
                // 禁用像素对齐，获得更平滑的相机移动
                camera.setRoundPixels(false);
                
                // 确保相机可见（移除可能导致黑屏的淡入效果）
                camera.setAlpha(1);
                
                console.log('相机跟随已设置，玩家位置:', this.playerBody.x, this.playerBody.y);
            } else if (camera) {
                // 如果玩家还没有创建，先设置相机边界和背景
                camera.setBounds(0, 0, 12000, 9000);
                camera.setBackgroundColor(0x000000);
                camera.setRoundPixels(false); // 禁用像素对齐
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
    
    // 设置鼠标控制 - 高性能实现，确保与系统鼠标完全一致
    private setupMouse() {
        try {
            // 创建美化的大尺寸十字准星
            this.crosshairGraphic = this.add.graphics();
            
            // 外圈黑色边框（更明显）
            this.crosshairGraphic.lineStyle(4, 0x000000, 0.9);
            this.crosshairGraphic.beginPath();
            this.crosshairGraphic.moveTo(0, -12);
            this.crosshairGraphic.lineTo(0, 12);
            this.crosshairGraphic.moveTo(-12, 0);
            this.crosshairGraphic.lineTo(12, 0);
            this.crosshairGraphic.strokePath();
            
            // 主十字线（红色，更粗）
            this.crosshairGraphic.lineStyle(3, 0xff0000, 1);
            this.crosshairGraphic.beginPath();
            this.crosshairGraphic.moveTo(0, -10);
            this.crosshairGraphic.lineTo(0, 10);
            this.crosshairGraphic.moveTo(-10, 0);
            this.crosshairGraphic.lineTo(10, 0);
            this.crosshairGraphic.strokePath();
            
            // 中心点（更大更明显）
            this.crosshairGraphic.fillStyle(0xff0000, 1);
            this.crosshairGraphic.fillCircle(0, 0, 3);
            
            // 外圈装饰点（四个角落）
            this.crosshairGraphic.fillStyle(0xffffff, 0.8);
            this.crosshairGraphic.fillCircle(-10, -10, 2);
            this.crosshairGraphic.fillCircle(10, -10, 2);
            this.crosshairGraphic.fillCircle(-10, 10, 2);
            this.crosshairGraphic.fillCircle(10, 10, 2);
            
            this.crosshairGraphic.setScrollFactor(0);
            this.crosshairGraphic.setDepth(10000);
            this.crosshairGraphic.setPosition(this.cameras.main.width / 2, this.cameras.main.height / 2);
            
            // 隐藏系统鼠标
            this.input.setDefaultCursor('none');
            
            // 使用高性能的鼠标跟踪（节流优化，减少卡顿）
            // 存储为实例属性，避免作用域问题
            (this as any)._crosshairLastUpdate = 0;
            (this as any)._crosshairPendingX = this.cameras.main.width / 2;
            (this as any)._crosshairPendingY = this.cameras.main.height / 2;
            
            // 使用原生DOM事件，性能更好（passive模式，不阻塞主线程）
            const gameCanvas = this.game.canvas;
            if (gameCanvas) {
                // 鼠标移动事件处理（高性能）
                const handleMouseMove = (e: MouseEvent) => {
                    // 快速计算坐标，不进行复杂操作
                    const rect = gameCanvas.getBoundingClientRect();
                    (this as any)._crosshairPendingX = e.clientX - rect.left;
                    (this as any)._crosshairPendingY = e.clientY - rect.top;
                };
                
                // 使用passive模式，提升性能
                gameCanvas.addEventListener('mousemove', handleMouseMove, { passive: true });
                (this as any)._mouseMoveHandler = handleMouseMove;
                
                // 阻止右键菜单弹出
                const preventContextMenu = (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                };
                
                gameCanvas.addEventListener('contextmenu', preventContextMenu, false);
                (this as any)._contextMenuHandler = preventContextMenu;
            }
            
            // 在update循环中更新十字准星位置（直接更新，无节流，确保流畅）
            (this as any)._updateCrosshair = () => {
                if (this.crosshairGraphic) {
                    // 直接更新位置，无延迟
                    this.crosshairGraphic.setPosition(
                        (this as any)._crosshairPendingX,
                        (this as any)._crosshairPendingY
                    );
                }
            };
            
            // 在document级别也阻止右键菜单（确保完全阻止）
            const preventContextMenu = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
            
            // 在document级别也阻止右键菜单（确保完全阻止）
            document.addEventListener('contextmenu', preventContextMenu, false);
            (this as any)._documentContextMenuHandler = preventContextMenu;
            
            // 射击控制
            this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (!this.gameStarted || !this.playerBody) return;
                if (pointer.button === 0) {
                    // 左键射击
                    this.shoot(pointer.worldX, pointer.worldY);
                    (this as any).isShooting = true;
                } else if (pointer.button === 2) {
                    // 右键显示信息
                    this.showObjectInfo(pointer.worldX, pointer.worldY);
                }
            });
            
            this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
                if (pointer.button === 0) {
                    (this as any).isShooting = false;
                }
            });
            
            (this as any).lastShootTime = 0;
            
        } catch (error) {
            console.error('设置鼠标控制时出错:', error);
        }
    }
    
    // 显示对象信息（鼠标右键）
    private showObjectInfo(worldX: number, worldY: number) {
        try {
            if (!this.gameStarted) return;
            
            // 先关闭之前的信息面板
            this.closeInfoPanel();
            
            const detectionRadius = 80; // 检测半径（增大以便更容易检测）
            
            // 1. 检测物品（优先使用graphic位置，如果没有则使用body位置）
            let foundItem: GameItem | null = null;
            let closestDistance = detectionRadius;
            
            for (const item of this.items) {
                if (!item) continue;
                
                // 获取物品位置：优先使用graphic位置，其次body位置，最后使用item的x/y属性
                let itemX: number, itemY: number;
                
                if (item.graphic) {
                    itemX = item.graphic.x;
                    itemY = item.graphic.y;
                } else if (item.body) {
                    itemX = item.body.x;
                    itemY = item.body.y;
                } else if (item.x !== undefined && item.y !== undefined) {
                    itemX = item.x;
                    itemY = item.y;
                } else {
                    continue;
                }
                
                const distance = Phaser.Math.Distance.Between(worldX, worldY, itemX, itemY);
                if (distance <= closestDistance) {
                    closestDistance = distance;
                    foundItem = item;
                }
            }
            
            // 2. 检测敌人
            let foundEnemy: Enemy | null = null;
            for (const enemy of this.enemies) {
                if (!enemy || !enemy.body || enemy.health <= 0) continue;
                const distance = Phaser.Math.Distance.Between(worldX, worldY, enemy.body.x, enemy.body.y);
                if (distance <= detectionRadius) {
                    foundEnemy = enemy;
                    break;
                }
            }
            
            // 3. 检测交互对象（优先检测撤离开关）
            let foundInteractive: any = null;
            let foundEvacuationSwitch: any = null;
            
            this.interactiveObjects.getChildren().forEach((obj: any) => {
                if (!obj || !obj.active) return;
                const distance = Phaser.Math.Distance.Between(worldX, worldY, obj.x, obj.y);
                if (distance <= detectionRadius) {
                    // 优先检测撤离开关
                    if (obj.getData('type') === 'evacuationSwitch') {
                        foundEvacuationSwitch = obj;
                    } else if (!foundInteractive) {
                        // 只有在没有找到撤离开关时才记录其他交互对象
                        foundInteractive = obj;
                    }
                }
            });
            
            // 优先显示：撤离开关 > 敌人 > 物品 > 其他交互对象
            if (foundEvacuationSwitch) {
                // 撤离开关由checkEvacuationSwitch()处理，这里不显示信息面板
                // 但可以添加额外的视觉提示
            } else if (foundEnemy) {
                this.createEnemyInfoPanel(foundEnemy, worldX, worldY);
            } else if (foundItem) {
                this.createItemInfoPanel(foundItem, worldX, worldY);
            } else if (foundInteractive) {
                this.createInteractiveInfoPanel(foundInteractive, worldX, worldY);
            }
            
        } catch (error) {
            console.error('显示对象信息时出错:', error);
        }
    }
    
    // 创建敌人信息面板
    private createEnemyInfoPanel(enemy: Enemy, worldX: number, worldY: number) {
        try {
            // 获取敌人类型信息
            const enemyType = enemy.type || 'grunt';
            const typeNames: { [key: string]: string } = {
                'grunt': '普通敌人',
                'soldier': '精英敌人',
                'captain': 'BOSS'
            };
            
            const detectRange = this.getEnemyDetectRange(enemyType);
            const attackRange = this.getEnemyAttackRange(enemyType);
            
            // 获取敌人伤害（从敌人定义中获取，如果没有则使用默认值）
            let enemyDamage = 10;
            if (enemyType === 'grunt') enemyDamage = 8;
            else if (enemyType === 'soldier') enemyDamage = 20;
            else if (enemyType === 'captain') enemyDamage = 45;
            
            // 创建面板容器
            const panel = this.add.container(0, 0);
            panel.setScrollFactor(0);
            panel.setDepth(2000);
            
            // 计算屏幕位置（将世界坐标转换为屏幕坐标）
            const screenX = worldX - this.cameras.main.scrollX;
            const screenY = worldY - this.cameras.main.scrollY;
            
            // 面板背景
            const bg = this.add.graphics();
            bg.fillStyle(0x000000, 0.9);
            bg.fillRoundedRect(0, 0, 280, 200, 10);
            bg.lineStyle(3, 0xff0000, 1);
            bg.strokeRoundedRect(0, 0, 280, 200, 10);
            bg.setPosition(screenX - 140, screenY - 100);
            panel.add(bg);
            
            // 标题
            const title = this.add.text(screenX - 130, screenY - 90, `🔴 ${typeNames[enemyType]}`, {
                fontSize: '20px',
                color: '#ff0000',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            panel.add(title);
            
            // 血量信息
            const healthPercent = (enemy.health / enemy.maxHealth) * 100;
            const healthColor = healthPercent > 60 ? '#00ff00' : (healthPercent > 30 ? '#ffaa00' : '#ff0000');
            const healthText = this.add.text(screenX - 130, screenY - 60, `❤️ 血量: ${Math.ceil(enemy.health)}/${enemy.maxHealth} (${Math.ceil(healthPercent)}%)`, {
                fontSize: '16px',
                color: healthColor,
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(healthText);
            
            // 伤害信息
            const damageText = this.add.text(screenX - 130, screenY - 35, `⚔️ 伤害: ${enemyDamage}`, {
                fontSize: '16px',
                color: '#ffaa00',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(damageText);
            
            // 速度信息
            const speedText = this.add.text(screenX - 130, screenY - 10, `🏃 速度: ${enemy.speed}`, {
                fontSize: '16px',
                color: '#00aaff',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(speedText);
            
            // 检测范围
            const detectText = this.add.text(screenX - 130, screenY + 15, `👁️ 检测范围: ${detectRange}`, {
                fontSize: '16px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(detectText);
            
            // 攻击范围
            const attackText = this.add.text(screenX - 130, screenY + 40, `🎯 攻击范围: ${attackRange}`, {
                fontSize: '16px',
                color: '#ff00ff',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(attackText);
            
            // 状态信息
            const stateNames: { [key: string]: string } = {
                'patrol': '巡逻',
                'chase': '追击',
                'attack': '攻击'
            };
            const stateText = this.add.text(screenX - 130, screenY + 65, `📍 状态: ${stateNames[enemy.state] || '未知'}`, {
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(stateText);
            
            this.infoPanel = panel;
            
            // 3秒后自动关闭
            this.time.delayedCall(3000, () => {
                this.closeInfoPanel();
            });
            
        } catch (error) {
            console.error('创建敌人信息面板时出错:', error);
        }
    }
    
    // 创建物品信息面板
    private createItemInfoPanel(item: GameItem, worldX: number, worldY: number) {
        try {
            // 创建面板容器
            const panel = this.add.container(0, 0);
            panel.setScrollFactor(0);
            panel.setDepth(2000);
            
            // 计算屏幕位置
            const screenX = worldX - this.cameras.main.scrollX;
            const screenY = worldY - this.cameras.main.scrollY;
            
            // 根据物品类型设置颜色和图标
            let itemColor = 0x00ff00;
            let itemIcon = '📦';
            let itemDescription = '';
            
            switch (item.type) {
                case 'weapon':
                    itemColor = 0xff0000;
                    itemIcon = '🔫';
                    itemDescription = '武器 - 可以切换使用';
                    break;
                case 'ammo':
                    itemColor = 0xffaa00;
                    itemIcon = '💣';
                    itemDescription = '弹药 - 为武器补充弹药';
                    break;
                case 'armor':
                    itemColor = 0x0000ff;
                    itemIcon = '🛡️';
                    // 根据稀有度显示护甲值
                    const armorValue = this.getArmorValueByRarity(item.rarity || ItemRarity.COMMON);
                    itemDescription = `护甲 - 提供 ${armorValue} 点防护（使用后消失）`;
                    break;
                case 'medical':
                    itemColor = 0x00ff00;
                    itemIcon = '💊';
                    itemDescription = '医疗物品 - 恢复生命值';
                    break;
                case 'money':
                    itemColor = 0xffd700;
                    itemIcon = '💰';
                    itemDescription = '金钱 - 游戏货币';
                    break;
                case 'artifact':
                    itemColor = 0x9b59b6;
                    itemIcon = '💎';
                    itemDescription = '遗物 - 稀有物品';
                    break;
                case 'resource':
                    itemColor = 0x95a5a6;
                    itemIcon = '⚙️';
                    itemDescription = '资源 - 材料物品';
                    break;
            }
            
            // 面板背景
            const bg = this.add.graphics();
            bg.fillStyle(0x000000, 0.9);
            bg.fillRoundedRect(0, 0, 280, 180, 10);
            bg.lineStyle(3, itemColor, 1);
            bg.strokeRoundedRect(0, 0, 280, 180, 10);
            bg.setPosition(screenX - 140, screenY - 90);
            panel.add(bg);
            
            // 标题
            const title = this.add.text(screenX - 130, screenY - 80, `${itemIcon} ${item.name || '未知物品'}`, {
                fontSize: '20px',
                color: `#${itemColor.toString(16)}`,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            panel.add(title);
            
            // 类型
            const typeText = this.add.text(screenX - 130, screenY - 50, `📋 类型: ${itemDescription}`, {
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(typeText);
            
            // 子类型（如果有）
            if (item.subtype) {
                const subtypeText = this.add.text(screenX - 130, screenY - 25, `🔖 子类型: ${item.subtype}`, {
                    fontSize: '16px',
                    color: '#aaaaaa',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                panel.add(subtypeText);
            }
            
            // 价值
            if (item.value !== undefined) {
                const valueText = this.add.text(screenX - 130, screenY, `💰 价值: ${item.value}`, {
                    fontSize: '16px',
                    color: '#ffd700',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                panel.add(valueText);
            }
            
            // 数量
            if (item.quantity !== undefined) {
                const quantityText = this.add.text(screenX - 130, screenY + 25, `📊 数量: ${item.quantity}`, {
                    fontSize: '16px',
                    color: '#00aaff',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                panel.add(quantityText);
            }
            
            // 稀有度
            if (item.rarity) {
                const rarityNames: { [key: string]: string } = {
                    'common': '普通',
                    'uncommon': '不常见',
                    'rare': '稀有',
                    'epic': '史诗',
                    'legendary': '传说'
                };
                const rarityColors: { [key: string]: string } = {
                    'common': '#ffffff',
                    'uncommon': '#00ff00',
                    'rare': '#0088ff',
                    'epic': '#aa00ff',
                    'legendary': '#ffaa00'
                };
                const rarityText = this.add.text(screenX - 130, screenY + 50, `⭐ 稀有度: ${rarityNames[item.rarity] || item.rarity}`, {
                    fontSize: '16px',
                    color: rarityColors[item.rarity] || '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                panel.add(rarityText);
            }
            
            // 重量
            if (item.weight !== undefined) {
                const weightText = this.add.text(screenX - 130, screenY + 75, `⚖️ 重量: ${item.weight}`, {
                    fontSize: '16px',
                    color: '#aaaaaa',
                    stroke: '#000000',
                    strokeThickness: 2
                });
                panel.add(weightText);
            }
            
            this.infoPanel = panel;
            
            // 3秒后自动关闭
            this.time.delayedCall(3000, () => {
                this.closeInfoPanel();
            });
            
        } catch (error) {
            console.error('创建物品信息面板时出错:', error);
        }
    }
    
    // 创建交互对象信息面板
    private createInteractiveInfoPanel(obj: any, worldX: number, worldY: number) {
        try {
            // 创建面板容器
            const panel = this.add.container(0, 0);
            panel.setScrollFactor(0);
            panel.setDepth(2000);
            
            // 计算屏幕位置
            const screenX = worldX - this.cameras.main.scrollX;
            const screenY = worldY - this.cameras.main.scrollY;
            
            const objType = obj.getData('type');
            const objName = obj.getData('name') || '未知对象';
            const objColor = obj.getData('color') || 0x0099CC;
            
            // 根据类型设置描述
            const typeDescriptions: { [key: string]: string } = {
                'terminal': '补给终端 - 可以获取补给和资源',
                'powerCore': '能量核心 - 提供能量支持',
                'dataDrive': '数据存储 - 存储重要数据',
                'medStation': '医疗站 - 可以恢复生命值',
                'armory': '军械库 - 可以获取武器和装备'
            };
            
            const description = typeDescriptions[objType] || '可交互对象';
            
            // 面板背景
            const bg = this.add.graphics();
            bg.fillStyle(0x000000, 0.9);
            bg.fillRoundedRect(0, 0, 280, 150, 10);
            bg.lineStyle(3, objColor, 1);
            bg.strokeRoundedRect(0, 0, 280, 150, 10);
            bg.setPosition(screenX - 140, screenY - 75);
            panel.add(bg);
            
            // 标题
            const title = this.add.text(screenX - 130, screenY - 65, `⚡ ${objName}`, {
                fontSize: '20px',
                color: `#${objColor.toString(16)}`,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            panel.add(title);
            
            // 类型
            const typeText = this.add.text(screenX - 130, screenY - 35, `📋 类型: ${objType}`, {
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(typeText);
            
            // 描述
            const descText = this.add.text(screenX - 130, screenY - 10, `📝 ${description}`, {
                fontSize: '14px',
                color: '#aaaaaa',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 240 }
            });
            panel.add(descText);
            
            // 状态
            const isActive = obj.getData('active');
            const statusText = this.add.text(screenX - 130, screenY + 30, `🔘 状态: ${isActive ? '激活' : '未激活'}`, {
                fontSize: '16px',
                color: isActive ? '#00ff00' : '#ff0000',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(statusText);
            
            // 提示
            const hintText = this.add.text(screenX - 130, screenY + 55, `💡 靠近后按E键交互`, {
                fontSize: '14px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 2
            });
            panel.add(hintText);
            
            this.infoPanel = panel;
            
            // 3秒后自动关闭
            this.time.delayedCall(3000, () => {
                this.closeInfoPanel();
            });
            
        } catch (error) {
            console.error('创建交互对象信息面板时出错:', error);
        }
    }
    
    // 关闭信息面板
    private closeInfoPanel() {
        try {
            if (this.infoPanel) {
                this.infoPanel.destroy();
                this.infoPanel = undefined;
            }
        } catch (error) {
            console.error('关闭信息面板时出错:', error);
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
                    // 尝试换弹（调用GameScene的reload方法以显示动画）
                    if (weapon.reserveAmmo > 0 && !weapon.isReloading) {
                        this.reload(); // 使用GameScene的reload方法，确保显示动画
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
            
            // 创建增强的子弹轨迹线（发光效果）
            const bulletGraphic = this.add.graphics();
            
            // 外层光晕（更亮）
            bulletGraphic.lineStyle(weapon.bulletSize + 2, weapon.color || weapon.bulletColor, isMain ? 0.4 : 0.3);
            bulletGraphic.beginPath();
            bulletGraphic.moveTo(fromX, fromY);
            bulletGraphic.lineTo(bulletEndX, bulletEndY);
            bulletGraphic.strokePath();
            
            // 主轨迹线
            bulletGraphic.lineStyle(weapon.bulletSize, weapon.color || weapon.bulletColor, isMain ? 1 : 0.8);
            bulletGraphic.beginPath();
            bulletGraphic.moveTo(fromX, fromY);
            bulletGraphic.lineTo(bulletEndX, bulletEndY);
            bulletGraphic.strokePath();
            
            // 内层高光（更亮的核心）
            bulletGraphic.lineStyle(Math.max(1, weapon.bulletSize - 1), 0xffffff, isMain ? 0.6 : 0.4);
            bulletGraphic.beginPath();
            bulletGraphic.moveTo(fromX, fromY);
            bulletGraphic.lineTo(bulletEndX, bulletEndY);
            bulletGraphic.strokePath();
            
            bulletGraphic.setDepth(60);
            
            // 子弹效果动画（更平滑的淡出）
            const travelDistance = Math.sqrt(Math.pow(bulletEndX - fromX, 2) + Math.pow(bulletEndY - fromY, 2));
            this.tweens.add({
                targets: bulletGraphic,
                alpha: { from: isMain ? 1 : 0.8, to: 0 },
                duration: travelDistance / weapon.bulletSpeed * 1000, // 根据实际距离计算持续时间
                ease: 'Power2.easeOut',
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
    
    // 创建墙壁击中特效（增强版）
    private createWallHitEffect(x: number, y: number, angle: number) {
        try {
            // 增强的火花效果
            const sparks = this.add.graphics();
            
            // 创建更多火花粒子，颜色更丰富
            for (let i = 0; i < 12; i++) {
                const sparkAngle = angle + Math.PI + (Math.random() - 0.5) * Math.PI * 1.5;
                const sparkDist = Math.random() * 20 + 8;
                const sparkX = Math.cos(sparkAngle) * sparkDist;
                const sparkY = Math.sin(sparkAngle) * sparkDist;
                
                // 随机火花颜色（黄色到橙色）
                const sparkColor = Phaser.Math.Between(0xffaa00, 0xff6600);
                const sparkSize = Math.random() * 2 + 1.5;
                sparks.fillStyle(sparkColor, 1);
                sparks.fillCircle(sparkX, sparkY, sparkSize);
            }
            
            sparks.setPosition(x, y);
            sparks.setDepth(62);
            
            // 火花动画（更长的持续时间）
            this.tweens.add({
                targets: sparks,
                alpha: { from: 1, to: 0 },
                scale: { from: 1, to: 1.5 },
                duration: 300,
                ease: 'Power2.easeOut',
                onComplete: () => sparks.destroy()
            });
            
            // 多层冲击波效果
            // 外层冲击波
            const impactOuter = this.add.graphics();
            impactOuter.fillStyle(0xffffff, 0.6);
            impactOuter.fillCircle(0, 0, 8);
            impactOuter.setPosition(x, y);
            impactOuter.setDepth(62);
            
            this.tweens.add({
                targets: impactOuter,
                scale: { from: 1, to: 3 },
                alpha: { from: 0.6, to: 0 },
                duration: 200,
                ease: 'Power2.easeOut',
                onComplete: () => impactOuter.destroy()
            });
            
            // 内层冲击波
            const impactInner = this.add.graphics();
            impactInner.fillStyle(0xffaa00, 0.9);
            impactInner.fillCircle(0, 0, 5);
            impactInner.setPosition(x, y);
            impactInner.setDepth(63);
            
            this.tweens.add({
                targets: impactInner,
                scale: { from: 1, to: 2 },
                alpha: { from: 0.9, to: 0 },
                duration: 150,
                ease: 'Power2.easeOut',
                onComplete: () => impactInner.destroy()
            });
            
            // 播放墙壁击中音效
            this.playWallHitSound();
            
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
            
            // 创建增强的闪光效果
            const flash = this.add.graphics();
            
            // 外层光晕（更亮更大）
            flash.fillStyle(0xffffff, 0.6);
            flash.fillCircle(0, 0, flashSize + 5);
            
            // 中层闪光（武器颜色）
            flash.fillStyle(color, 0.9);
            flash.fillCircle(0, 0, flashSize);
            
            // 主闪光 - 黄白色
            flash.fillStyle(0xffff00, 0.9);
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
    
    // 获取或创建AudioContext（优化版：确保状态正确）
    private getAudioContext(): AudioContext | null {
        try {
            // 使用共享的AudioContext，避免频繁创建
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                } catch (e) {
                    console.warn('无法创建AudioContext:', e);
                    return null;
                }
            }
            
            // 如果AudioContext被暂停（浏览器策略），尝试恢复
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => {
                    // 如果恢复失败，尝试重新创建
                    try {
                        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    } catch (e2) {
                        console.warn('无法重新创建AudioContext:', e2);
                        return null;
                    }
                });
            }
            
            // 确保AudioContext状态正常
            if (this.audioContext.state === 'closed') {
                try {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                } catch (e) {
                    console.warn('AudioContext已关闭，无法重新创建:', e);
                    return null;
                }
            }
            
            return this.audioContext;
        } catch (error) {
            console.error('获取AudioContext时出错:', error);
            return null;
        }
    }
    
    // 播放射击音效（使用Web Audio API生成程序化音效）
    private playShootSound(weapon: Weapon) {
        try {
            const audioContext = this.getAudioContext();
            if (!audioContext) return;
            
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
                try {
                    oscillator.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // 忽略断开连接错误
                }
            };
            
        } catch (error) {
            console.error('播放射击音效时出错:', error);
        }
    }
    
    // 播放换弹音效（优化版：使用共享AudioContext）
    private playReloadSound() {
        try {
            const audioContext = this.getAudioContext();
            if (!audioContext) return;
            
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
                try {
                    oscillator1.disconnect();
                } catch (e) {
                    // 忽略断开连接错误
                }
            };
            oscillator2.onended = () => {
                try {
                    oscillator2.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // 忽略断开连接错误
                }
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
            // 根据武器精度调整误差范围 - 收紧命中范围，更精确的判定
            const angleError = weapon.precision ? (1 - weapon.precision) * 0.2 : 0.15; // 减小命中范围，更严格
            
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
                
                // 计算角度差 - 更严格的命中判定
                const enemyAngle = Phaser.Math.Angle.Between(fromX, fromY, enemyX, enemyY);
                const angleDiff = Math.abs(Phaser.Math.Angle.ShortestBetween(angle, enemyAngle));
                
                // 使用更严格的角度容差，并考虑敌人碰撞体积
                const enemyRadius = 15; // 敌人碰撞半径（像素）
                const maxAngleDiff = Math.max(angleError * 180 / Math.PI, Math.atan2(enemyRadius, enemyDist) * 180 / Math.PI);
                // 角度容差应该基于敌人大小和距离，而不是固定值
                
                // 额外检查：使用射线检测确保子弹路径会经过敌人附近
                const bulletEndX = fromX + Math.cos(angle) * enemyDist;
                const bulletEndY = fromY + Math.sin(angle) * enemyDist;
                const distToEnemy = Phaser.Math.Distance.Between(bulletEndX, bulletEndY, enemyX, enemyY);
                
                // 只有当角度差异在容差内，且子弹路径足够接近敌人时才判定为命中
                return angleDiff < maxAngleDiff && distToEnemy < enemyRadius * 1.5;
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
            
            // 房间定义（网格坐标，与扩大后的地图匹配）
            const rooms = {
                start: { x: 15, y: 15, width: 15, height: 12 },
                left: { x: 15, y: 33, width: 12, height: 9 },
                main: { x: 36, y: 15, width: 18, height: 15 },
                right: { x: 60, y: 15, width: 12, height: 12 },
                treasure: { x: 36, y: 36, width: 15, height: 12 },
                evac: { x: 57, y: 33, width: 12, height: 9 },
                safe: { x: 7, y: 22, width: 7, height: 7 },
                supply: { x: 36, y: 7, width: 12, height: 6 }
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
                // 起始房间 - 增加交互设备
                { ...getRoomPos('start', 3, 4), type: 'terminal', color: 0x0099CC, name: '补给终端' },
                { ...getRoomPos('start', 5, 5), type: 'medStation', color: 0xFF3366, name: '医疗站' },
                
                // 中央大厅 - 增加更多终端（适配更大的房间）
                { ...getRoomPos('main', 5, 4), type: 'terminal', color: 0x0099CC, name: '战术终端' },
                { ...getRoomPos('main', 11, 4), type: 'terminal', color: 0x0099CC, name: '装备终端' },
                { ...getRoomPos('main', 9, 7), type: 'terminal', color: 0x0099CC, name: '指挥终端' },
                { ...getRoomPos('main', 7, 3), type: 'terminal', color: 0x0099CC, name: '信息终端' },
                { ...getRoomPos('main', 13, 6), type: 'terminal', color: 0x0099CC, name: '系统终端' },
                
                // 右侧房间 - 增加设备
                { ...getRoomPos('right', 6, 6), type: 'terminal', color: 0x0099CC, name: '资源终端' },
                { ...getRoomPos('right', 5, 5), type: 'armory', color: 0x6600FF, name: '军械库' },
                
                // 能量核心 - 增加数量，分布在各个房间
                { ...getRoomPos('main', 7, 7), type: 'powerCore', color: 0xFF6600, name: '能量核心' },
                { ...getRoomPos('treasure', 7, 6), type: 'powerCore', color: 0xFF6600, name: '高级能量核心' },
                { ...getRoomPos('right', 4, 4), type: 'powerCore', color: 0xFF6600, name: '超级能量核心' },
                { ...getRoomPos('start', 7, 6), type: 'powerCore', color: 0xFF6600, name: '基础能量核心' },
                { ...getRoomPos('left', 5, 4), type: 'powerCore', color: 0xFF6600, name: '能量核心' },
                
                // 数据存储设备 - 增加数量
                { ...getRoomPos('left', 5, 5), type: 'dataDrive', color: 0x00CCFF, name: '数据存储' },
                { ...getRoomPos('treasure', 6, 5), type: 'dataDrive', color: 0x00CCFF, name: '机密数据' },
                { ...getRoomPos('main', 6, 5), type: 'dataDrive', color: 0x00CCFF, name: '战术数据' },
                { ...getRoomPos('right', 7, 5), type: 'dataDrive', color: 0x00CCFF, name: '装备数据' },
                
                // 医疗站 - 增加数量
                { ...getRoomPos('main', 6, 4), type: 'medStation', color: 0xFF3366, name: '医疗站' },
                { ...getRoomPos('treasure', 8, 7), type: 'medStation', color: 0xFF3366, name: '高级医疗站' },
                { ...getRoomPos('left', 6, 4), type: 'medStation', color: 0xFF3366, name: '医疗站' },
                { ...getRoomPos('right', 8, 6), type: 'medStation', color: 0xFF3366, name: '医疗站' },
                
                // 军械库终端 - 增加数量
                { ...getRoomPos('right', 6, 4), type: 'armory', color: 0x6600FF, name: '军械库' },
                { ...getRoomPos('left', 4, 3), type: 'armory', color: 0x6600FF, name: '武器库' },
                { ...getRoomPos('main', 4, 5), type: 'armory', color: 0x6600FF, name: '装备库' },
                
                // 补给站房间
                { ...getRoomPos('supply', 6, 3), type: 'terminal', color: 0x0099CC, name: '补给终端' }
            ];
            
            interactiveObjects.forEach(pos => {
                const obj = this.physics.add.sprite(pos.x, pos.y, '');
                obj.setSize(40, 40);
                obj.setImmovable(true);
                obj.setVisible(false); // 隐藏物理碰撞体的方块显示
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
                        
                        // 添加终端脉冲效果（简化版本，减少性能消耗）
                        const terminalPulse = this.add.graphics();
                        terminalPulse.fillStyle(pos.color, 0.15);
                        terminalPulse.fillRect(-25, -25, 50, 50);
                        terminalPulse.setPosition(pos.x, pos.y);
                        terminalPulse.setDepth(49);
                        
                        // 使用更长的动画时间，减少更新频率
                        this.tweens.add({
                            targets: terminalPulse,
                            scale: { from: 1, to: 1.2, yoyo: true },
                            alpha: { from: 0.15, to: 0, yoyo: true },
                            duration: 3000,
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
                        
                        // 能量脉冲效果 - 优化版本（减少动画复杂度）
                        const pulseGraphic = this.add.graphics();
                        pulseGraphic.fillStyle(pos.color, 0.25);
                        pulseGraphic.fillCircle(0, 0, 30);
                        pulseGraphic.setPosition(pos.x, pos.y);
                        pulseGraphic.setDepth(49);
                        
                        // 使用更长的动画时间，减少更新频率
                        this.tweens.add({
                            targets: pulseGraphic,
                            scale: { from: 1, to: 1.4, yoyo: true },
                            alpha: { from: 0.25, to: 0, yoyo: true },
                            duration: 2000,
                            repeat: -1,
                            ease: 'Cubic.easeInOut'
                        });
                        
                        obj.setData('pulseGraphic', pulseGraphic);
                        
                        // 移除核心闪烁效果，减少tween数量
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
                        
                        // 医疗站光环效果（优化版本）
                        const medGlow = this.add.graphics();
                        medGlow.fillStyle(0xFF0000, 0.15);
                        medGlow.fillCircle(0, 0, 35);
                        medGlow.setPosition(pos.x, pos.y);
                        medGlow.setDepth(49);
                        
                        // 使用更长的动画时间
                        this.tweens.add({
                            targets: medGlow,
                            scale: { from: 1, to: 1.15, yoyo: true },
                            alpha: { from: 0.15, to: 0, yoyo: true },
                            duration: 2500,
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
                        
                        // 军械库能量盾效果（优化版本）
                        const armorShield = this.add.graphics();
                        armorShield.lineStyle(2, 0x9900FF, 0.25);
                        armorShield.strokeCircle(0, 0, 30);
                        armorShield.setPosition(pos.x, pos.y);
                        armorShield.setDepth(49);
                        
                        // 使用更长的动画时间
                        this.tweens.add({
                            targets: armorShield,
                            scale: { from: 1, to: 1.25, yoyo: true },
                            alpha: { from: 0.25, to: 0, yoyo: true },
                            duration: 3500,
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
                
                // 移除所有物体的呼吸效果，减少tween数量以提升性能
                
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
                start: { x: 15, y: 15, width: 15, height: 12 },
                left: { x: 15, y: 33, width: 12, height: 9 },
                main: { x: 36, y: 15, width: 18, height: 15 },
                right: { x: 60, y: 15, width: 12, height: 12 },
                treasure: { x: 36, y: 36, width: 15, height: 12 }
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
                obj.setVisible(false); // 隐藏物理碰撞体的方块显示
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
                const armorToAdd = reward.amount || 0;
                (this as any).playerArmor = Math.min(((this as any).playerArmor || 0) + armorToAdd, 100);
                this.updateArmorBar?.();
                message = `${reward.message || ''}（+${armorToAdd}护甲）`;
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
    
    // 生成随机物品（根据稀有度概率）
    private generateRandomItem(x: number, y: number): any {
        // 稀有度概率：普通60%，不常见25%，稀有10%，史诗4%，传说1%
        const rarityRoll = Math.random();
        let rarity: ItemRarity;
        if (rarityRoll < 0.01) {
            rarity = ItemRarity.LEGENDARY;
        } else if (rarityRoll < 0.05) {
            rarity = ItemRarity.EPIC;
        } else if (rarityRoll < 0.15) {
            rarity = ItemRarity.RARE;
        } else if (rarityRoll < 0.40) {
            rarity = ItemRarity.UNCOMMON;
        } else {
            rarity = ItemRarity.COMMON;
        }
        
        // 物品类型定义（按稀有度分类）
        const itemDefinitions: any[] = [];
        
                // 普通物品（60%概率）
        if (rarity === ItemRarity.COMMON) {
            itemDefinitions.push(
                // 金钱类
                { type: 'money', subtype: 'coin', name: '💰 金币', value: 10, rarity: ItemRarity.COMMON },
                { type: 'money', subtype: 'coin', name: '💰 金币', value: 20, rarity: ItemRarity.COMMON },
                { type: 'money', subtype: 'coin', name: '💰 金币', value: 30, rarity: ItemRarity.COMMON },
                { type: 'money', subtype: 'paper', name: '💵 纸币', value: 50, rarity: ItemRarity.COMMON },
                // 医疗类（普通：5 HP）
                { type: 'medical', subtype: 'bandage', name: '🩹 绷带', value: 5, rarity: ItemRarity.COMMON },
                { type: 'medical', subtype: 'pills', name: '💊 止痛药', value: 5, rarity: ItemRarity.COMMON },
                { type: 'medical', subtype: 'disinfectant', name: '🧴 消毒剂', value: 5, rarity: ItemRarity.COMMON },
                // 弹药类（只保留4种武器对应的弹药）
                { type: 'ammo', subtype: 'pistol', name: '📦 手枪弹药', value: 15, rarity: ItemRarity.COMMON },
                { type: 'ammo', subtype: 'pistol', name: '📦 手枪弹药', value: 20, rarity: ItemRarity.COMMON },
                // 资源类
                { type: 'resource', subtype: 'scrap', name: '⚙️ 废料', value: 5, rarity: ItemRarity.COMMON },
                { type: 'resource', subtype: 'wire', name: '🔌 电线', value: 8, rarity: ItemRarity.COMMON },
                { type: 'resource', subtype: 'battery', name: '🔋 电池', value: 12, rarity: ItemRarity.COMMON },
                // 食物类
                { type: 'resource', subtype: 'food', name: '🍞 面包', value: 15, rarity: ItemRarity.COMMON },
                { type: 'resource', subtype: 'water', name: '💧 水', value: 10, rarity: ItemRarity.COMMON }
            );
        }
        
        // 不常见物品（25%概率）
        if (rarity === ItemRarity.UNCOMMON) {
            itemDefinitions.push(
                // 金钱类
                { type: 'money', subtype: 'silver', name: '🪙 银币', value: 50, rarity: ItemRarity.UNCOMMON },
                { type: 'money', subtype: 'cash', name: '💵 现金', value: 100, rarity: ItemRarity.UNCOMMON },
                { type: 'money', subtype: 'cash', name: '💵 现金', value: 150, rarity: ItemRarity.UNCOMMON },
                { type: 'money', subtype: 'watch', name: '⌚ 手表', value: 200, rarity: ItemRarity.UNCOMMON },
                // 医疗类（不常见：10 HP）
                { type: 'medical', subtype: 'medkit', name: '💉 医疗包', value: 10, rarity: ItemRarity.UNCOMMON },
                { type: 'medical', subtype: 'syringe', name: '💉 注射器', value: 10, rarity: ItemRarity.UNCOMMON },
                { type: 'medical', subtype: 'firstaid', name: '🩹 急救包', value: 10, rarity: ItemRarity.UNCOMMON },
                { type: 'medical', subtype: 'antiseptic', name: '🧪 抗菌剂', value: 10, rarity: ItemRarity.UNCOMMON },
                // 护甲类
                { type: 'armor', subtype: 'vest', name: '🛡️ 防弹背心', value: 30, rarity: ItemRarity.UNCOMMON },
                { type: 'armor', subtype: 'helmet', name: '⛑️ 头盔', value: 25, rarity: ItemRarity.UNCOMMON },
                { type: 'armor', subtype: 'gloves', name: '🧤 战术手套', value: 15, rarity: ItemRarity.UNCOMMON },
                // 弹药类（只保留4种武器对应的弹药）
                { type: 'ammo', subtype: 'rifle', name: '📦 步枪弹药', value: 30, rarity: ItemRarity.UNCOMMON },
                { type: 'ammo', subtype: 'rifle', name: '📦 步枪弹药', value: 40, rarity: ItemRarity.UNCOMMON },
                // 资源类
                { type: 'resource', subtype: 'electronics', name: '📱 电子元件', value: 80, rarity: ItemRarity.UNCOMMON },
                { type: 'resource', subtype: 'circuit', name: '🔲 电路板', value: 120, rarity: ItemRarity.UNCOMMON },
                { type: 'resource', subtype: 'metal', name: '🔩 金属零件', value: 100, rarity: ItemRarity.UNCOMMON },
                // 武器类（只保留4种武器）
                { type: 'weapon', subtype: 'pistol', name: '🔫 手枪', value: 1, rarity: ItemRarity.UNCOMMON }
            );
        }
        
        // 稀有物品（10%概率）
        if (rarity === ItemRarity.RARE) {
            itemDefinitions.push(
                // 金钱类
                { type: 'money', subtype: 'antique', name: '🏺 古董', value: 500, rarity: ItemRarity.RARE },
                { type: 'money', subtype: 'sculpture', name: '🗿 雕塑', value: 800, rarity: ItemRarity.RARE },
                { type: 'money', subtype: 'goldbar', name: '🥇 金条', value: 1000, rarity: ItemRarity.RARE },
                { type: 'money', subtype: 'jewelry', name: '💍 珠宝', value: 600, rarity: ItemRarity.RARE },
                // 医疗类（稀有：20 HP）
                { type: 'medical', subtype: 'advanced', name: '💊 高级医疗包', value: 20, rarity: ItemRarity.RARE },
                { type: 'medical', subtype: 'adrenaline', name: '💉 肾上腺素', value: 20, rarity: ItemRarity.RARE },
                { type: 'medical', subtype: 'surgical', name: '⚕️ 手术包', value: 20, rarity: ItemRarity.RARE },
                { type: 'medical', subtype: 'steroid', name: '💊 类固醇', value: 20, rarity: ItemRarity.RARE },
                // 护甲类
                { type: 'armor', subtype: 'heavy', name: '🛡️ 重型护甲', value: 60, rarity: ItemRarity.RARE },
                { type: 'armor', subtype: 'tactical', name: '🛡️ 战术护甲', value: 50, rarity: ItemRarity.RARE },
                { type: 'armor', subtype: 'plate', name: '🛡️ 板甲', value: 55, rarity: ItemRarity.RARE },
                // 武器类（只保留4种武器）
                { type: 'weapon', subtype: 'rifle', name: '🔫 步枪', value: 2, rarity: ItemRarity.RARE },
                { type: 'weapon', subtype: 'shotgun', name: '🔫 霰弹枪', value: 3, rarity: ItemRarity.RARE },
                // 弹药类（只保留4种武器对应的弹药）
                { type: 'ammo', subtype: 'shotgun', name: '📦 霰弹枪弹药', value: 12, rarity: ItemRarity.RARE },
                // 资源类
                { type: 'resource', subtype: 'gpu', name: '🎮 显卡', value: 1200, rarity: ItemRarity.RARE },
                { type: 'resource', subtype: 'cpu', name: '💻 CPU', value: 1500, rarity: ItemRarity.RARE },
                { type: 'resource', subtype: 'memory', name: '💾 内存条', value: 1000, rarity: ItemRarity.RARE },
                { type: 'resource', subtype: 'crystal', name: '💎 水晶', value: 800, rarity: ItemRarity.RARE }
            );
        }
        
        // 史诗物品（4%概率）
        if (rarity === ItemRarity.EPIC) {
            itemDefinitions.push(
                // 金钱类
                { type: 'money', subtype: 'diamond', name: '💎 钻石', value: 2000, rarity: ItemRarity.EPIC },
                { type: 'money', subtype: 'treasure', name: '💎 宝藏', value: 3000, rarity: ItemRarity.EPIC },
                { type: 'money', subtype: 'emerald', name: '💚 翡翠', value: 2500, rarity: ItemRarity.EPIC },
                { type: 'money', subtype: 'sapphire', name: '💙 蓝宝石', value: 2200, rarity: ItemRarity.EPIC },
                // 医疗类（史诗：40 HP）
                { type: 'medical', subtype: 'nanotech', name: '💉 纳米医疗', value: 40, rarity: ItemRarity.EPIC },
                { type: 'medical', subtype: 'regeneration', name: '💊 再生药剂', value: 40, rarity: ItemRarity.EPIC },
                { type: 'medical', subtype: 'stemcell', name: '🧬 干细胞治疗', value: 40, rarity: ItemRarity.EPIC },
                { type: 'medical', subtype: 'plasma', name: '🩸 血浆包', value: 40, rarity: ItemRarity.EPIC },
                // 护甲类
                { type: 'armor', subtype: 'exosuit', name: '🛡️ 外骨骼护甲', value: 80, rarity: ItemRarity.EPIC },
                { type: 'armor', subtype: 'power', name: '🛡️ 动力护甲', value: 75, rarity: ItemRarity.EPIC },
                { type: 'armor', subtype: 'energy', name: '🛡️ 能量护盾', value: 70, rarity: ItemRarity.EPIC },
                // 武器类（只保留4种武器）
                { type: 'weapon', subtype: 'sniper', name: '🔫 狙击枪', value: 4, rarity: ItemRarity.EPIC },
                // 弹药类（只保留4种武器对应的弹药）
                { type: 'ammo', subtype: 'sniper', name: '📦 狙击枪弹药', value: 15, rarity: ItemRarity.EPIC },
                // 资源类
                { type: 'resource', subtype: 'rare_gpu', name: '🎮 高端显卡', value: 2500, rarity: ItemRarity.EPIC },
                { type: 'resource', subtype: 'quantum', name: '⚛️ 量子芯片', value: 3000, rarity: ItemRarity.EPIC },
                { type: 'resource', subtype: 'plasma', name: '⚡ 等离子核心', value: 2800, rarity: ItemRarity.EPIC },
                // 神器类
                { type: 'artifact', subtype: 'ancient', name: '🏺 古代神器', value: 5000, rarity: ItemRarity.EPIC }
            );
        }
        
        // 传说物品（1%概率）
        if (rarity === ItemRarity.LEGENDARY) {
            itemDefinitions.push(
                // 金钱类
                { type: 'money', subtype: 'crown', name: '👑 王冠', value: 5000, rarity: ItemRarity.LEGENDARY },
                { type: 'money', subtype: 'artifact', name: '🏺 古代遗物', value: 8000, rarity: ItemRarity.LEGENDARY },
                { type: 'money', subtype: 'phoenix', name: '🔥 凤凰之羽', value: 10000, rarity: ItemRarity.LEGENDARY },
                // 医疗类（传说：80 HP）
                { type: 'medical', subtype: 'immortal', name: '💉 不死药剂', value: 80, rarity: ItemRarity.LEGENDARY },
                { type: 'medical', subtype: 'elixir', name: '🧪 生命药水', value: 80, rarity: ItemRarity.LEGENDARY },
                { type: 'medical', subtype: 'divine', name: '✨ 神圣治疗', value: 80, rarity: ItemRarity.LEGENDARY },
                { type: 'medical', subtype: 'resurrection', name: '⚰️ 复活药剂', value: 80, rarity: ItemRarity.LEGENDARY },
                // 护甲类
                { type: 'armor', subtype: 'legendary', name: '🛡️ 传说护甲', value: 100, rarity: ItemRarity.LEGENDARY },
                { type: 'armor', subtype: 'divine', name: '🛡️ 神圣护甲', value: 95, rarity: ItemRarity.LEGENDARY },
                { type: 'armor', subtype: 'immortal', name: '🛡️ 不朽护甲', value: 100, rarity: ItemRarity.LEGENDARY },
                // 武器类（移除多余的传说武器，只保留4种基础武器）
                // 资源类
                { type: 'resource', subtype: 'legendary_gpu', name: '🎮 传说级显卡', value: 5000, rarity: ItemRarity.LEGENDARY },
                { type: 'resource', subtype: 'godchip', name: '⚡ 神级芯片', value: 8000, rarity: ItemRarity.LEGENDARY },
                { type: 'resource', subtype: 'infinity', name: '∞ 无限核心', value: 10000, rarity: ItemRarity.LEGENDARY },
                // 神器类
                { type: 'artifact', subtype: 'ancient', name: '🏺 古代神器', value: 10000, rarity: ItemRarity.LEGENDARY },
                { type: 'artifact', subtype: 'divine', name: '✨ 神圣遗物', value: 15000, rarity: ItemRarity.LEGENDARY },
                { type: 'artifact', subtype: 'cosmic', name: '🌌 宇宙碎片', value: 20000, rarity: ItemRarity.LEGENDARY }
            );
        }
        
        // 随机选择一个物品
        if (itemDefinitions.length === 0) {
            // 如果没有匹配的，返回一个普通金币
            return { type: 'money', subtype: 'coin', name: '💰 金币', value: 10, rarity: ItemRarity.COMMON, x, y };
        }
        
        const selected = itemDefinitions[Math.floor(Math.random() * itemDefinitions.length)];
        return { ...selected, x, y };
    }
    
    // 掉落物品 - 使用精美的物品外观系统
    private dropItem(x: number, y: number) {
        try {
            // 使用新的物品生成系统
            const itemDef = this.generateRandomItem(x, y);
            
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
            
            // 房间定义（网格坐标，与扩大后的地图匹配）
            const rooms = {
                start: { x: 15, y: 15, width: 15, height: 12 },
                left: { x: 15, y: 33, width: 12, height: 9 },
                main: { x: 36, y: 15, width: 18, height: 15 },
                right: { x: 60, y: 15, width: 12, height: 12 },
                treasure: { x: 36, y: 36, width: 15, height: 12 }
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
                // 起始房间物品（增加数量，适配扩大后的房间）
                { ...getRoomPos('start', 4, 3), type: 'money' as const, value: 200, room: 'start' },
                { ...getRoomPos('start', 3, 4), type: 'armor' as const, value: 25, room: 'start', name: '轻型护甲' },
                { ...getRoomPos('start', 5, 2), type: 'weapon' as const, value: 1, room: 'start', name: '手枪', subtype: 'pistol' },
                { ...getRoomPos('start', 2, 2), type: 'ammo' as const, value: 15, room: 'start', name: '手枪弹药', subtype: 'pistol' },
                { ...getRoomPos('start', 6, 4), type: 'money' as const, value: 150, room: 'start' },
                { ...getRoomPos('start', 7, 3), type: 'medical' as const, value: 5, room: 'start', name: '绷带', rarity: ItemRarity.COMMON, subtype: 'bandage' },
                { ...getRoomPos('start', 8, 5), type: 'ammo' as const, value: 12, room: 'start', name: '手枪弹药', subtype: 'pistol' },
                
                // 左侧房间物品（增加数量）
                { ...getRoomPos('left', 3, 4), type: 'medical' as const, value: 10, room: 'left', name: '医疗包', rarity: ItemRarity.UNCOMMON, subtype: 'medkit' },
                { ...getRoomPos('left', 4, 3), type: 'money' as const, value: 350, room: 'left' },
                { ...getRoomPos('left', 2, 5), type: 'ammo' as const, value: 20, room: 'left', name: '步枪弹药', subtype: 'rifle' },
                { ...getRoomPos('left', 2, 2), type: 'weapon' as const, value: 2, room: 'left', name: '步枪', subtype: 'rifle' },
                { ...getRoomPos('left', 5, 4), type: 'armor' as const, value: 30, room: 'left', name: '中型护甲' },
                { ...getRoomPos('left', 6, 5), type: 'money' as const, value: 250, room: 'left' },
                { ...getRoomPos('left', 7, 3), type: 'ammo' as const, value: 18, room: 'left', name: '步枪弹药', subtype: 'rifle' },
                
                // 中央大厅物品（增加数量，适配更大的房间）
                { ...getRoomPos('main', 9, 3), type: 'money' as const, value: 500, room: 'main' },
                { ...getRoomPos('main', 8, 5), type: 'armor' as const, value: 40, room: 'main', name: '重型护甲' },
                { ...getRoomPos('main', 10, 4), type: 'medical' as const, value: 5, room: 'main', name: '绷带', rarity: ItemRarity.COMMON, subtype: 'bandage' },
                { ...getRoomPos('main', 11, 3), type: 'ammo' as const, value: 10, room: 'main', name: '霰弹枪弹药', subtype: 'shotgun' },
                { ...getRoomPos('main', 7, 2), type: 'ammo' as const, value: 5, room: 'main', name: '手枪弹药', subtype: 'pistol' },
                { ...getRoomPos('main', 12, 6), type: 'money' as const, value: 400, room: 'main' },
                { ...getRoomPos('main', 5, 4), type: 'medical' as const, value: 10, room: 'main', name: '医疗包', rarity: ItemRarity.UNCOMMON, subtype: 'medkit' },
                { ...getRoomPos('main', 6, 7), type: 'ammo' as const, value: 8, room: 'main', name: '霰弹枪弹药', subtype: 'shotgun' },
                { ...getRoomPos('main', 14, 5), type: 'money' as const, value: 300, room: 'main' },
                { ...getRoomPos('main', 4, 6), type: 'armor' as const, value: 35, room: 'main', name: '中型护甲' },
                
                // 右侧房间物品（增加数量）
                { ...getRoomPos('right', 6, 3), type: 'weapon' as const, value: 3, room: 'right', name: '霰弹枪', subtype: 'shotgun' },
                { ...getRoomPos('right', 5, 4), type: 'ammo' as const, value: 30, room: 'right', name: '手枪弹药箱', subtype: 'pistol' },
                { ...getRoomPos('right', 7, 2), type: 'ammo' as const, value: 15, room: 'right', name: '步枪弹药', subtype: 'rifle' },
                { ...getRoomPos('right', 4, 5), type: 'money' as const, value: 450, room: 'right' },
                { ...getRoomPos('right', 8, 4), type: 'medical' as const, value: 10, room: 'right', name: '医疗包', rarity: ItemRarity.UNCOMMON, subtype: 'medkit' },
                { ...getRoomPos('right', 5, 6), type: 'ammo' as const, value: 12, room: 'right', name: '霰弹枪弹药', subtype: 'shotgun' },
                { ...getRoomPos('right', 9, 5), type: 'armor' as const, value: 45, room: 'right', name: '重型护甲' },
                
                // 宝藏房间物品（稀有和高价值，增加数量）
                { ...getRoomPos('treasure', 7, 7), type: 'artifact' as const, value: 2000, room: 'treasure', name: '古代遗物' },
                { ...getRoomPos('treasure', 6, 6), type: 'money' as const, value: 1000, room: 'treasure' },
                { ...getRoomPos('treasure', 8, 6), type: 'money' as const, value: 1000, room: 'treasure' },
                { ...getRoomPos('treasure', 6, 8), type: 'medical' as const, value: 40, room: 'treasure', name: '纳米医疗', rarity: ItemRarity.EPIC, subtype: 'nanotech' },
                { ...getRoomPos('treasure', 8, 8), type: 'armor' as const, value: 75, room: 'treasure', name: '终极护甲' },
                { ...getRoomPos('treasure', 7, 5), type: 'weapon' as const, value: 4, room: 'treasure', name: '狙击枪', subtype: 'sniper' },
                { ...getRoomPos('treasure', 6, 7), type: 'ammo' as const, value: 10, room: 'treasure', name: '狙击枪弹药', subtype: 'sniper' },
                { ...getRoomPos('treasure', 8, 7), type: 'ammo' as const, value: 20, room: 'treasure', name: '霰弹枪弹药箱', subtype: 'shotgun' },
                { ...getRoomPos('treasure', 5, 6), type: 'money' as const, value: 800, room: 'treasure' },
                { ...getRoomPos('treasure', 9, 6), type: 'money' as const, value: 800, room: 'treasure' },
                
                // 走廊中的零散物品（更新坐标，适配新地图）
                { x: 30 * gridSize + 40, y: 18 * gridSize, type: 'money' as const, value: 150, room: 'corridor' },
                { x: 42 * gridSize, y: 30 * gridSize, type: 'medical' as const, value: 5, room: 'corridor', name: '止痛药', rarity: ItemRarity.COMMON, subtype: 'pills' },
                { x: 54 * gridSize + 40, y: 18 * gridSize + 40, type: 'money' as const, value: 400, room: 'corridor' },
                { x: 36 * gridSize, y: 30 * gridSize, type: 'ammo' as const, value: 3, room: 'corridor', name: '狙击枪弹药', subtype: 'sniper' },
                { x: 45 * gridSize, y: 25 * gridSize, type: 'ammo' as const, value: 15, room: 'corridor', name: '步枪弹药', subtype: 'rifle' },
                { x: 48 * gridSize, y: 20 * gridSize, type: 'money' as const, value: 200, room: 'corridor' },
                { x: 33 * gridSize, y: 25 * gridSize, type: 'medical' as const, value: 5, room: 'corridor', name: '绷带', rarity: ItemRarity.COMMON, subtype: 'bandage' },
                
                // 资源类物品（增加数量）
                { ...getRoomPos('main', 5, 3), type: 'resource' as const, value: 50, room: 'main', name: '金属碎片', subtype: 'metal' },
                { ...getRoomPos('main', 11, 5), type: 'resource' as const, value: 30, room: 'main', name: '布料', subtype: 'fabric' },
                { ...getRoomPos('right', 6, 6), type: 'resource' as const, value: 80, room: 'right', name: '电子元件', subtype: 'electronics' },
                { ...getRoomPos('treasure', 5, 7), type: 'resource' as const, value: 60, room: 'treasure', name: '稀有金属', subtype: 'metal' },
                { ...getRoomPos('left', 4, 5), type: 'resource' as const, value: 40, room: 'left', name: '高级布料', subtype: 'fabric' },
                { ...getRoomPos('main', 13, 4), type: 'resource' as const, value: 45, room: 'main', name: '电子元件', subtype: 'electronics' },
                { ...getRoomPos('right', 7, 6), type: 'resource' as const, value: 55, room: 'right', name: '金属碎片', subtype: 'metal' }
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
                    // 金币 - 精美的3D金币设计
                    // 外圈金色（主色调）
                    graphic.fillStyle(0xffd700, 1);
                    graphic.fillCircle(0, 0, 14);
                    
                    // 外圈边框（更深的金色）
                    graphic.lineStyle(2, 0xffa500, 1);
                    graphic.strokeCircle(0, 0, 14);
                    
                    // 内圈高光（模拟3D效果）
                    graphic.fillStyle(0xffffaa, 1);
                    graphic.fillCircle(-4, -4, 8);
                    
                    // 中间阴影（增加立体感）
                    graphic.fillStyle(0xffa500, 0.6);
                    graphic.fillCircle(2, 2, 6);
                    
                    // 金币中心装饰 - 星星图案
                    graphic.fillStyle(0xffffff, 0.9);
                    this.drawStar(graphic, 0, 0, 3, 5);
                    graphic.fillPath();
                    
                    // $符号（更精美的设计）
                    graphic.lineStyle(2.5, 0xffffff, 1);
                    graphic.beginPath();
                    // 竖线
                    graphic.moveTo(-1, -8);
                    graphic.lineTo(-1, 8);
                    // S形上半部分
                    graphic.moveTo(-1, -5);
                    graphic.lineTo(1, -5);
                    graphic.lineTo(1, -2);
                    graphic.lineTo(-1, -2);
                    // S形下半部分
                    graphic.moveTo(1, 2);
                    graphic.lineTo(-1, 2);
                    graphic.lineTo(-1, 5);
                    graphic.lineTo(1, 5);
                    graphic.strokePath();
                    
                    // 金币边缘装饰（锯齿效果）
                    graphic.lineStyle(1, 0xffa500, 0.8);
                    for (let i = 0; i < 12; i++) {
                        const angle = (i / 12) * Math.PI * 2;
                        const x1 = Math.cos(angle) * 13;
                        const y1 = Math.sin(angle) * 13;
                        const x2 = Math.cos(angle) * 14;
                        const y2 = Math.sin(angle) * 14;
                        graphic.beginPath();
                        graphic.moveTo(x1, y1);
                        graphic.lineTo(x2, y2);
                        graphic.strokePath();
                    }
                    
                    // 添加光芒效果
                    glowGraphic = this.createGlowEffect(0xffd700, def.x, def.y, 28);
                    
                    // 添加旋转动画
                    this.addItemAnimation(graphic, 'rotate', def.x, def.y);
                    break;
                    
                case 'medical':
                    // 医疗物品 - 精美的3D医疗包设计
                    // 医疗包主体（3D效果）
                    graphic.fillStyle(0x2ecc71, 1);
                    graphic.fillRoundedRect(-12, -10, 24, 18, 4);
                    
                    // 顶部高光（3D效果）
                    graphic.fillStyle(0x58d68d, 1);
                    graphic.fillRoundedRect(-12, -10, 24, 10, 4);
                    
                    // 侧面阴影（3D效果）
                    graphic.fillStyle(0x27ae60, 1);
                    graphic.fillRoundedRect(-12, -2, 6, 12, 2);
                    
                    // 外边框
                    graphic.lineStyle(2.5, 0x27ae60, 1);
                    graphic.strokeRoundedRect(-12, -10, 24, 18, 4);
                    
                    // 内部高光边框
                    graphic.lineStyle(1, 0x58d68d, 0.6);
                    graphic.strokeRoundedRect(-10, -8, 20, 14, 3);
                    
                    // 红色医疗十字（更精美的设计）
                    graphic.fillStyle(0xe74c3c, 1);
                    // 横条
                    graphic.fillRoundedRect(-7, -2, 14, 5, 1);
                    // 竖条
                    graphic.fillRoundedRect(-2, -7, 5, 14, 1);
                    
                    // 白色十字边框（增强对比）
                    graphic.lineStyle(1.5, 0xffffff, 1);
                    graphic.strokeRoundedRect(-7, -2, 14, 5, 1);
                    graphic.strokeRoundedRect(-2, -7, 5, 14, 1);
                    
                    // 十字内部高光
                    graphic.fillStyle(0xff6b6b, 0.8);
                    graphic.fillRoundedRect(-5, -1, 10, 3, 1);
                    graphic.fillRoundedRect(-1, -5, 3, 10, 1);
                    
                    // 顶部提手（更真实的3D设计）
                    graphic.fillStyle(0x34495e, 1);
                    graphic.fillRoundedRect(-6, -12, 12, 4, 2);
                    graphic.lineStyle(1.5, 0x2c3e50, 1);
                    graphic.strokeRoundedRect(-6, -12, 12, 4, 2);
                    
                    // 提手高光
                    graphic.fillStyle(0x5d6d7e, 0.8);
                    graphic.fillRoundedRect(-5, -11, 10, 2, 1);
                    
                    // 医疗包细节 - 拉链装饰
                    graphic.lineStyle(1, 0x1e8449, 0.6);
                    graphic.beginPath();
                    graphic.moveTo(-8, -8);
                    graphic.lineTo(8, -8);
                    graphic.moveTo(-8, 0);
                    graphic.lineTo(8, 0);
                    graphic.strokePath();
                    
                    // 添加脉动效果
                    this.addItemAnimation(graphic, 'pulse', def.x, def.y);
                    glowGraphic = this.createGlowEffect(0x2ecc71, def.x, def.y, 22);
                    break;
                    
                case 'armor':
                    // 护甲 - 精美的3D盾牌设计
                    // 盾牌外圈（深蓝色）
                    graphic.fillStyle(0x2874a6, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -12);
                    graphic.lineTo(-9, -6);
                    graphic.lineTo(-10, 2);
                    graphic.lineTo(-7, 10);
                    graphic.lineTo(7, 10);
                    graphic.lineTo(10, 2);
                    graphic.lineTo(9, -6);
                    graphic.closePath();
                    graphic.fill();
                    
                    // 中圈高光（3D效果）
                    graphic.fillStyle(0x3498db, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -10);
                    graphic.lineTo(-6, -4);
                    graphic.lineTo(-7, 3);
                    graphic.lineTo(-5, 8);
                    graphic.lineTo(5, 8);
                    graphic.lineTo(7, 3);
                    graphic.lineTo(6, -4);
                    graphic.closePath();
                    graphic.fill();
                    
                    // 内圈高光（更亮）
                    graphic.fillStyle(0x5dade2, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -8);
                    graphic.lineTo(-4, -3);
                    graphic.lineTo(-5, 2);
                    graphic.lineTo(-3, 6);
                    graphic.lineTo(3, 6);
                    graphic.lineTo(5, 2);
                    graphic.lineTo(4, -3);
                    graphic.closePath();
                    graphic.fill();
                    
                    // 盾牌中心装饰（金属徽章）
                    graphic.fillStyle(0x1b4f72, 1);
                    graphic.fillCircle(0, 0, 5);
                    
                    // 徽章边框
                    graphic.lineStyle(2, 0x85c1e9, 1);
                    graphic.strokeCircle(0, 0, 5);
                    
                    // 徽章内部装饰 - 十字
                    graphic.fillStyle(0xffffff, 0.9);
                    graphic.fillRect(-3, -1, 6, 2);
                    graphic.fillRect(-1, -3, 2, 6);
                    
                    // 外边框（深色）
                    graphic.lineStyle(2.5, 0x1b4f72, 1);
                    graphic.beginPath();
                    graphic.moveTo(0, -12);
                    graphic.lineTo(-9, -6);
                    graphic.lineTo(-10, 2);
                    graphic.lineTo(-7, 10);
                    graphic.lineTo(7, 10);
                    graphic.lineTo(10, 2);
                    graphic.lineTo(9, -6);
                    graphic.closePath();
                    graphic.strokePath();
                    
                    // 盾牌装饰线条（增强细节）
                    graphic.lineStyle(1, 0x5dade2, 0.5);
                    graphic.beginPath();
                    graphic.moveTo(0, -10);
                    graphic.lineTo(0, 8);
                    graphic.moveTo(-6, -4);
                    graphic.lineTo(6, -4);
                    graphic.strokePath();
                    
                    // 添加轻微摇摆
                    this.addItemAnimation(graphic, 'sway', def.x, def.y);
                    glowGraphic = this.createGlowEffect(0x3498db, def.x, def.y, 24);
                    break;
                    
                case 'artifact':
                    // 遗物 - 精美的神秘宝石设计（3D效果）
                    // 外圈紫色（最外层）
                    graphic.fillStyle(0x8e44ad, 1);
                    graphic.fillCircle(0, 0, 16);
                    
                    // 中圈紫色（渐变）
                    graphic.fillStyle(0x9b59b6, 1);
                    graphic.fillCircle(0, 0, 12);
                    
                    // 内圈亮紫色
                    graphic.fillStyle(0xbb8fce, 1);
                    graphic.fillCircle(0, 0, 9);
                    
                    // 核心金色发光（模拟能量核心）
                    graphic.fillStyle(0xf4d03f, 1);
                    graphic.fillCircle(0, 0, 7);
                    
                    // 核心内部高光
                    graphic.fillStyle(0xffffff, 0.9);
                    graphic.fillCircle(-2, -2, 4);
                    
                    // 装饰星星（多层）
                    // 外层星星
                    this.drawStar(graphic, 0, 0, 8, 11);
                    graphic.fillStyle(0xffffff, 0.6);
                    graphic.fillPath();
                    
                    // 内层星星
                    this.drawStar(graphic, 0, 0, 5, 7);
                    graphic.fillStyle(0xf4d03f, 0.8);
                    graphic.fillPath();
                    
                    // 外边框（多层）
                    graphic.lineStyle(2.5, 0x6c3483, 1);
                    graphic.strokeCircle(0, 0, 16);
                    
                    graphic.lineStyle(1.5, 0xf4d03f, 0.7);
                    graphic.strokeCircle(0, 0, 12);
                    
                    graphic.lineStyle(1, 0xffffff, 0.5);
                    graphic.strokeCircle(0, 0, 9);
                    
                    // 边缘装饰（神秘符文效果）
                    graphic.lineStyle(1, 0xf4d03f, 0.6);
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        const x1 = Math.cos(angle) * 14;
                        const y1 = Math.sin(angle) * 14;
                        const x2 = Math.cos(angle) * 16;
                        const y2 = Math.sin(angle) * 16;
                        graphic.beginPath();
                        graphic.moveTo(x1, y1);
                        graphic.lineTo(x2, y2);
                        graphic.strokePath();
                    }
                    
                    // 强烈的发光效果
                    glowGraphic = this.createGlowEffect(0x8e44ad, def.x, def.y, 38);
                    
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
                    
                    // 根据形状绘制（更精美的3D设计）
                    if (resourceShape === 'hexagon') {
                        // 六边形金属（3D效果）
                        // 外圈
                        graphic.fillStyle(resourceColor, 1);
                        graphic.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI / 3) * i;
                            const x = Math.cos(angle) * 10;
                            const y = Math.sin(angle) * 10;
                            if (i === 0) graphic.moveTo(x, y);
                            else graphic.lineTo(x, y);
                        }
                        graphic.closePath();
                        graphic.fill();
                        
                        // 内圈高光
                        graphic.fillStyle(0xecf0f1, 0.8);
                        graphic.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI / 3) * i;
                            const x = Math.cos(angle) * 7;
                            const y = Math.sin(angle) * 7;
                            if (i === 0) graphic.moveTo(x, y);
                            else graphic.lineTo(x, y);
                        }
                        graphic.closePath();
                        graphic.fill();
                        
                        // 边框
                        graphic.lineStyle(2.5, 0x7f8c8d, 1);
                        graphic.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI / 3) * i;
                            const x = Math.cos(angle) * 10;
                            const y = Math.sin(angle) * 10;
                            if (i === 0) graphic.moveTo(x, y);
                            else graphic.lineTo(x, y);
                        }
                        graphic.closePath();
                        graphic.strokePath();
                        
                        // 中心高光点
                        graphic.fillStyle(0xffffff, 0.9);
                        graphic.fillCircle(-3, -3, 2.5);
                    } else if (resourceShape === 'circle') {
                        // 圆形布料（3D效果）
                        // 外圈
                        graphic.fillStyle(resourceColor, 1);
                        graphic.fillCircle(0, 0, 10);
                        
                        // 高光区域
                        graphic.fillStyle(0xfef5e7, 0.9);
                        graphic.fillCircle(-3, -3, 7);
                        
                        // 边框
                        graphic.lineStyle(2.5, 0xe67e22, 1);
                        graphic.strokeCircle(0, 0, 10);
                        
                        // 纹理效果（编织感）
                        graphic.lineStyle(1, 0xd4ac0d, 0.6);
                        for (let i = 0; i < 4; i++) {
                            const angle = (Math.PI * 2 / 4) * i;
                            graphic.beginPath();
                            graphic.moveTo(0, 0);
                            graphic.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
                            graphic.strokePath();
                        }
                        
                        // 内部纹理线条
                        graphic.lineStyle(1, 0xf8c471, 0.4);
                        graphic.beginPath();
                        graphic.moveTo(-7, 0);
                        graphic.lineTo(7, 0);
                        graphic.moveTo(0, -7);
                        graphic.lineTo(0, 7);
                        graphic.strokePath();
                    } else {
                        // 方形电子元件（3D电路板效果）
                        // 主体
                        graphic.fillStyle(resourceColor, 1);
                        graphic.fillRoundedRect(-8, -8, 16, 16, 3);
                        
                        // 顶部高光（3D效果）
                        graphic.fillStyle(0x5dade2, 1);
                        graphic.fillRoundedRect(-8, -8, 16, 8, 3);
                        
                        // 边框
                        graphic.lineStyle(2.5, 0x2874a6, 1);
                        graphic.strokeRoundedRect(-8, -8, 16, 16, 3);
                        
                        // 电路板效果（更精细）
                        graphic.lineStyle(1.5, 0x1b4f72, 0.9);
                        graphic.strokeRect(-6, -6, 12, 12);
                        
                        // 电路线（更复杂）
                        graphic.lineStyle(1, 0x1b4f72, 0.8);
                        graphic.beginPath();
                        // 垂直线
                        graphic.moveTo(-3, -6);
                        graphic.lineTo(-3, 6);
                        graphic.moveTo(3, -6);
                        graphic.lineTo(3, 6);
                        // 水平线
                        graphic.moveTo(-6, -3);
                        graphic.lineTo(6, -3);
                        graphic.moveTo(-6, 3);
                        graphic.lineTo(6, 3);
                        // 对角线
                        graphic.moveTo(-6, -6);
                        graphic.lineTo(6, 6);
                        graphic.moveTo(6, -6);
                        graphic.lineTo(-6, 6);
                        graphic.strokePath();
                        
                        // 发光点（LED效果）
                        graphic.fillStyle(0x00ffff, 1);
                        graphic.fillCircle(-3, -3, 1.5);
                        graphic.fillCircle(3, 3, 1.5);
                        graphic.fillCircle(-3, 3, 1.5);
                        graphic.fillCircle(3, -3, 1.5);
                        
                        // LED高光
                        graphic.fillStyle(0xffffff, 0.9);
                        graphic.fillCircle(-3, -3, 0.8);
                        graphic.fillCircle(3, 3, 0.8);
                        graphic.fillCircle(-3, 3, 0.8);
                        graphic.fillCircle(3, -3, 0.8);
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
            body.setVisible(false); // 隐藏物理碰撞体的方块显示
            
            // 根据物品类型设置属性
            let weight = 0;
            let rarity = def.rarity || ItemRarity.COMMON; // 使用传入的稀有度，如果没有则默认普通
            let durability: number | undefined = undefined;
            let maxDurability: number | undefined = undefined;
            
            // 根据稀有度设置医疗物品的治疗量（如果未设置）
            if (def.type === 'medical' && !def.value) {
                switch (rarity) {
                    case ItemRarity.COMMON:
                        def.value = 5; // 灰色：5 HP
                        break;
                    case ItemRarity.UNCOMMON:
                        def.value = 10; // 绿色：10 HP
                        break;
                    case ItemRarity.RARE:
                        def.value = 20; // 蓝色：20 HP
                        break;
                    case ItemRarity.EPIC:
                        def.value = 40; // 紫色：40 HP
                        break;
                    case ItemRarity.LEGENDARY:
                        def.value = 80; // 金色：80 HP
                        break;
                }
            }
            
            // 医疗物品使用耐久度系统：value存储剩余治疗量，maxDurability存储最大治疗量
            if (def.type === 'medical') {
                // 如果医疗物品没有设置稀有度，根据value推断稀有度
                if (!def.rarity) {
                    const healValue = def.value || 5;
                    if (healValue <= 5) {
                        rarity = ItemRarity.COMMON;
                    } else if (healValue <= 10) {
                        rarity = ItemRarity.UNCOMMON;
                    } else if (healValue <= 20) {
                        rarity = ItemRarity.RARE;
                    } else if (healValue <= 40) {
                        rarity = ItemRarity.EPIC;
                    } else {
                        rarity = ItemRarity.LEGENDARY;
                    }
                    def.rarity = rarity;
                }
                
                // 根据稀有度设置正确的治疗量（覆盖旧值）
                switch (rarity) {
                    case ItemRarity.COMMON:
                        def.value = 5; // 灰色：5 HP
                        break;
                    case ItemRarity.UNCOMMON:
                        def.value = 10; // 绿色：10 HP
                        break;
                    case ItemRarity.RARE:
                        def.value = 20; // 蓝色：20 HP
                        break;
                    case ItemRarity.EPIC:
                        def.value = 40; // 紫色：40 HP
                        break;
                    case ItemRarity.LEGENDARY:
                        def.value = 80; // 金色：80 HP
                        break;
                }
                
                // 设置最大治疗量和剩余治疗量
                def.maxDurability = def.value;
                // value作为剩余治疗量，初始等于最大治疗量
                if (!def.value) {
                    def.value = def.maxDurability;
                }
            }
            
            switch (def.type) {
                case 'weapon':
                    weight = 5; // 武器较重
                    // 如果稀有度未设置，根据武器类型设置
                    if (!def.rarity) {
                        rarity = def.value === 4 ? ItemRarity.EPIC : (def.value >= 2 ? ItemRarity.RARE : ItemRarity.UNCOMMON);
                    }
                    durability = 100;
                    maxDurability = 100;
                    break;
                case 'armor':
                    weight = 8; // 护甲最重
                    // 如果稀有度未设置，根据护甲值设置
                    if (!def.rarity) {
                        rarity = def.value >= 75 ? ItemRarity.EPIC : (def.value >= 40 ? ItemRarity.RARE : ItemRarity.UNCOMMON);
                    }
                    durability = 100;
                    maxDurability = 100;
                    break;
                case 'ammo':
                    weight = 0.5; // 弹药较轻
                    if (!def.rarity) {
                        rarity = ItemRarity.COMMON;
                    }
                    break;
                case 'medical':
                    weight = 2; // 医疗物品中等重量
                    // 稀有度已在上面根据治疗量设置
                    break;
                case 'artifact':
                    weight = 3; // 工艺品中等重量
                    if (!def.rarity) {
                        rarity = ItemRarity.LEGENDARY;
                    }
                    break;
                case 'money':
                    weight = 0.1; // 金钱很轻
                    // 稀有度已在生成时设置
                    break;
                case 'resource':
                    weight = 1; // 资源类物品较轻
                    // 稀有度已在生成时设置
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
            
            // 房间定义（网格坐标，与扩大后的地图匹配）
            const rooms = {
                left: { x: 15, y: 33, width: 12, height: 9 },
                main: { x: 36, y: 15, width: 18, height: 15 },
                right: { x: 60, y: 15, width: 12, height: 12 },
                treasure: { x: 36, y: 36, width: 15, height: 12 }
            };
            
            // 辅助函数：将房间内的相对坐标转换为世界坐标（避免墙壁）
            const getRoomPos = (room: string, offsetX: number, offsetY: number) => {
                const roomDef = rooms[room as keyof typeof rooms];
                if (!roomDef) return { x: offsetX * gridSize, y: offsetY * gridSize };
                // 确保敌人生成在房间内部，远离墙壁（扩大后的房间使用更大的安全边距）
                const safeMargin = 2; // 安全边距（扩大后使用更大的边距）
                const clampedX = Math.max(safeMargin, Math.min(roomDef.width - safeMargin, offsetX));
                const clampedY = Math.max(safeMargin, Math.min(roomDef.height - safeMargin, offsetY));
                return {
                    x: (roomDef.x + clampedX) * gridSize,
                    y: (roomDef.y + clampedY) * gridSize
                };
            };
            
            // 根据房间物资价值分配敌人（确保每个房间都有敌人，宝藏室有BOSS）
            // 起始房间（价值约400）：2-3个grunt
            // 左侧房间（价值约700）：2个grunt + 1个soldier
            // 中央大厅（价值约1500）：2个grunt + 3个soldier
            // 右侧房间（价值约600）：2个grunt + 1个soldier
            // 宝藏房间（价值约6000）：1个captain BOSS + 4个soldier + 1个grunt
            const enemyDefinitions = [
                // 起始房间（价值约400）- 基础敌人
                { ...getRoomPos('start', 5, 4), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'start' },
                { ...getRoomPos('start', 7, 5), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'start' },
                { ...getRoomPos('start', 9, 4), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'start' },
                
                // 左侧房间（价值约700）- 少量精英
                { ...getRoomPos('left', 4, 4), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'left' },
                { ...getRoomPos('left', 7, 5), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'left' },
                { ...getRoomPos('left', 5, 6), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'left' },
                
                // 中央大厅（价值约1500）- 中等强度
                { ...getRoomPos('main', 9, 7), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'main' },
                { ...getRoomPos('main', 12, 5), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'main' },
                { ...getRoomPos('main', 6, 5), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'main' },
                { ...getRoomPos('main', 14, 7), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'main' },
                { ...getRoomPos('main', 5, 8), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'main' },
                
                // 右侧房间（价值约600）- 少量精英
                { ...getRoomPos('right', 6, 6), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'right' },
                { ...getRoomPos('right', 5, 7), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'right' },
                { ...getRoomPos('right', 7, 5), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'right' },
                
                // 宝藏房间（价值约6000）- BOSS和精英守卫
                { ...getRoomPos('treasure', 7, 6), type: 'captain', health: 500, damage: 45, speed: 140, room: 'treasure' },
                { ...getRoomPos('treasure', 6, 7), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'treasure' },
                { ...getRoomPos('treasure', 8, 7), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'treasure' },
                { ...getRoomPos('treasure', 5, 6), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'treasure' },
                { ...getRoomPos('treasure', 9, 6), type: 'soldier', health: 180, damage: 20, speed: 160, room: 'treasure' },
                { ...getRoomPos('treasure', 7, 8), type: 'grunt', health: 60, damage: 8, speed: 120, room: 'treasure' },
                
                // 走廊中的少量巡逻敌人（降低数量）
                { x: 30 * gridSize + 40, y: 18 * gridSize, type: 'grunt', health: 60, damage: 8, speed: 120, room: 'corridor' },
                { x: 42 * gridSize, y: 30 * gridSize, type: 'grunt', health: 60, damage: 8, speed: 120, room: 'corridor' }
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
            
            // 确保物理体已激活且可移动
            if (body.body) {
                (body.body as any).setAllowGravity(false); // 禁用重力（2D游戏）
                (body.body as any).setAllowRotation(false); // 禁用旋转
                // 确保物理体是活动的（Arcade物理体默认就是激活的）
                (body.body as any).setActive?.(true);
                (body.body as any).setEnable?.(true);
                body.body.setImmovable(false); // 确保可移动
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
        // 根据房间类型生成不同的巡逻路径（使用扩大后的网格坐标）
        const rooms = {
            start: { x: 15, y: 15, width: 15, height: 12 },
            left: { x: 15, y: 33, width: 12, height: 9 },
            main: { x: 36, y: 15, width: 18, height: 15 },
            right: { x: 60, y: 15, width: 12, height: 12 },
            treasure: { x: 36, y: 36, width: 15, height: 12 }
        };
        
        const roomDef = rooms[room as keyof typeof rooms];
        if (!roomDef) {
            // 如果没有房间定义（如走廊），使用起始位置周围的小范围巡逻
            return [
                {x: startX - 100, y: startY - 100},
                {x: startX + 100, y: startY - 100},
                {x: startX + 100, y: startY + 100},
                {x: startX - 100, y: startY + 100}
            ];
        }
        
        // 在房间内生成巡逻路径（使用更大的边距，确保路径在房间中心区域）
        const margin = 1.5; // 距离墙壁的边距（网格单位，增大以确保巡逻路径在房间内）
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
            // 使用正确的撤离点房间坐标（与房间定义一致）
            const evacRoom = { x: 57, y: 33, width: 12, height: 9 };
            const evacCenterX = (evacRoom.x + evacRoom.width / 2) * gridSize;
            const evacCenterY = (evacRoom.y + evacRoom.height / 2) * gridSize;
            
            // 撤离区域半径（120像素）
            const evacuationRadius = 120;
            
            // 只在撤离点房间中心创建一个撤离点
            const pos = { x: evacCenterX, y: evacCenterY };
            
            // 创建撤离区域图形（大圆圈，初始为灰色未激活状态）
            const zoneGraphic = this.add.graphics();
            zoneGraphic.fillStyle(0x888888, 0.2); // 灰色半透明（未激活）
            zoneGraphic.fillCircle(0, 0, evacuationRadius);
            zoneGraphic.lineStyle(3, 0x888888, 0.5); // 灰色边框（未激活）
            zoneGraphic.strokeCircle(0, 0, evacuationRadius);
            zoneGraphic.setPosition(pos.x, pos.y);
            zoneGraphic.setDepth(39); // 在中心标记下方
            zoneGraphic.setVisible(true);
            zoneGraphic.setAlpha(0.3); // 初始半透明
            
            // 创建中心标记图形（小圆圈，初始为灰色未激活状态）
            const graphic = this.add.graphics();
            graphic.fillStyle(0x888888, 0.5); // 灰色（未激活）
            graphic.fillCircle(0, 0, 20);
            graphic.lineStyle(3, 0x888888, 1); // 灰色边框（未激活）
            graphic.strokeCircle(0, 0, 20);
            graphic.lineStyle(3, 0xffffff, 1);
            graphic.lineBetween(-15, 0, 15, 0);
            graphic.lineBetween(0, -15, 0, 15);
            graphic.setPosition(pos.x, pos.y);
            graphic.setDepth(40);
            graphic.setVisible(true);
            
            // 创建标签文本（初始为灰色未激活状态）
            const labelText = this.add.text(
                pos.x,
                pos.y - evacuationRadius - 30,
                '撤离点\n(未激活)',
                {
                    fontSize: '18px',
                    color: '#888888', // 灰色（未激活）
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: { left: 10, right: 10, top: 5, bottom: 5 },
                    align: 'center'
                }
            );
            labelText.setOrigin(0.5);
            labelText.setDepth(50);
            labelText.setVisible(true);
            
            // 创建撤离点对象
            const evacPoint: EvacuationPoint = {
                x: pos.x,
                y: pos.y,
                graphic,
                zoneGraphic,
                labelText,
                radius: evacuationRadius,
                active: false,
                isCountdownActive: false
            };
            
            this.evacuationPoints.push(evacPoint);
            
            console.log(`添加撤离点: 位置(${pos.x}, ${pos.y}), 半径=${evacuationRadius}px`);
            console.log(`撤离点房间: x=${evacRoom.x}, y=${evacRoom.y}, width=${evacRoom.width}, height=${evacRoom.height}`);
            
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
    
    // 更新敌人AI - 智能状态机系统（性能优化版）
    private updateEnemies(_delta: number) {
        try {
            // 只在游戏开始后更新敌人
            if (!this.gameStarted || !this.playerBody) return;
            
            // 不再标准化delta，直接使用原始值以保持物理更新正确
            const delta = _delta;
            
            // 收集已死亡的敌人，稍后批量移除（避免在forEach中修改数组）
            const deadEnemies: any[] = [];
            
            // 性能优化：只更新屏幕内的敌人（视锥剔除）
            const camera = this.cameras.main;
            const camX = camera.scrollX;
            const camY = camera.scrollY;
            const camWidth = camera.width;
            const camHeight = camera.height;
            const viewBounds = {
                left: camX - 200,   // 扩大视野范围，确保边缘敌人也能更新
                right: camX + camWidth + 200,
                top: camY - 200,
                bottom: camY + camHeight + 200
            };
            
            // 遍历所有敌人，确保每个敌人都能被处理
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const enemy = this.enemies[i];
                
                // 确保敌人和物理体都存在且有效
                if (!enemy || !enemy.body || !enemy.body.body) {
                    deadEnemies.push(enemy);
                    continue;
                }
                
                // 检查是否已死亡
                if (enemy.health <= 0) {
                    deadEnemies.push(enemy);
                    continue;
                }
                
                // 确保使用物理体的实际位置（而非缓存的x/y）
                const enemyX = enemy.body.x;
                const enemyY = enemy.body.y;
                
                // 性能优化：只更新屏幕内的敌人（视锥剔除）
                if (enemyX < viewBounds.left || enemyX > viewBounds.right ||
                    enemyY < viewBounds.top || enemyY > viewBounds.bottom) {
                    // 敌人不在视野内，只更新位置，不更新AI
                    enemy.graphic.setPosition(enemyX, enemyY);
                    if (enemy.eyeGraphic) {
                        enemy.eyeGraphic.setPosition(enemyX, enemyY);
                    }
                    if (enemy.healthBarBg) {
                        enemy.healthBarBg.setPosition(enemyX, enemyY);
                    }
                    if (enemy.healthBar) {
                        enemy.healthBar.setPosition(enemyX, enemyY);
                    }
                    if (enemy.typeLabel) {
                        enemy.typeLabel.setPosition(enemyX, enemyY - 45);
                    }
                    continue; // 跳过AI更新
                }
                
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
                
                // 更新敌人位置和图形（优化版：使用已计算的enemyX和enemyY）
                enemy.x = enemyX;
                enemy.y = enemyY;
                
                // 性能优化：每帧更新位置以确保流畅，但降低其他视觉效果更新频率
                // 位置更新（每帧，确保流畅）
                enemy.graphic.setPosition(enemyX, enemyY);
                if (enemy.eyeGraphic) {
                    enemy.eyeGraphic.setPosition(enemyX, enemyY);
                }
                if (enemy.healthBarBg) {
                    enemy.healthBarBg.setPosition(enemyX, enemyY);
                }
                if (enemy.healthBar) {
                    enemy.healthBar.setPosition(enemyX, enemyY);
                }
                if (enemy.typeLabel) {
                    enemy.typeLabel.setPosition(enemyX, enemyY - 45);
                }
                
                // 性能优化：大幅减少眼睛更新频率（每30帧更新一次，减少卡顿）
                if (!(enemy as any).eyeUpdateCounter) (enemy as any).eyeUpdateCounter = 0;
                (enemy as any).eyeUpdateCounter++;
                if ((enemy as any).eyeUpdateCounter % 30 === 0) {
                    this.updateEnemyEyes(enemy);
                }
                
                // 性能优化：大幅减少血量条重绘频率（每30帧更新一次，减少卡顿）
                if (enemy.healthBar) {
                    if (!(enemy as any).healthUpdateCounter) (enemy as any).healthUpdateCounter = 0;
                    (enemy as any).healthUpdateCounter++;
                    if ((enemy as any).healthUpdateCounter % 30 === 0) {
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
                
                // 性能优化：大幅减少状态视觉更新频率（每24帧更新一次，减少卡顿）
                if (!(enemy as any).stateVisualCounter) (enemy as any).stateVisualCounter = 0;
                (enemy as any).stateVisualCounter++;
                if ((enemy as any).stateVisualCounter % 24 === 0) {
                    this.updateEnemyStateVisual(enemy);
                }
            }
            
            // 批量移除已死亡的敌人（性能优化：避免在循环中修改数组）
            if (deadEnemies.length > 0) {
                deadEnemies.forEach(deadEnemy => {
                    this.killEnemy(deadEnemy);
                });
            }
            
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
    
    // 获取敌人检测范围（根据敌人类型，差距明显）
    private getEnemyDetectRange(type: string): number {
        switch (type) {
            case 'grunt': return 220;  // 普通敌人检测范围较小
            case 'soldier': return 380; // 精英敌人检测范围较大
            case 'captain': return 500;  // BOSS检测范围很大
            default: return 300;
        }
    }
    
    // 获取敌人攻击范围（射击范围，根据敌人类型，差距明显）
    private getEnemyAttackRange(type: string): number {
        switch (type) {
            case 'grunt': return 180;  // 普通敌人射程较短
            case 'soldier': return 320; // 精英敌人射程较长
            case 'captain': return 450;  // BOSS射程很长
            default: return 250;
        }
    }
    
    // 执行巡逻行为
    private executePatrolBehavior(enemy: any) {
        if (!enemy || !enemy.body || !enemy.body.body) return;
        
        // 使用物理体的实际位置
        const enemyX = enemy.body.x;
        const enemyY = enemy.body.y;
        
        if (!enemy.patrolPath || enemy.patrolPath.length === 0) {
            // 如果没有巡逻路径，基于敌人房间生成巡逻路径
            const room = enemy.room || 'corridor';
            enemy.patrolPath = this.generatePatrolPath(room, enemyX, enemyY);
            enemy.patrolIndex = 0;
            
            // 如果生成的路径为空，创建基于当前位置和房间边界的简单巡逻
            if (!enemy.patrolPath || enemy.patrolPath.length === 0) {
                const roomBounds = this.getRoomBounds(room);
                if (roomBounds) {
                    // 在房间边界内生成巡逻点
                    enemy.patrolPath = [
                        { x: roomBounds.minX + (roomBounds.maxX - roomBounds.minX) * 0.3, y: roomBounds.minY + (roomBounds.maxY - roomBounds.minY) * 0.3 },
                        { x: roomBounds.minX + (roomBounds.maxX - roomBounds.minX) * 0.7, y: roomBounds.minY + (roomBounds.maxY - roomBounds.minY) * 0.3 },
                        { x: roomBounds.minX + (roomBounds.maxX - roomBounds.minX) * 0.7, y: roomBounds.minY + (roomBounds.maxY - roomBounds.minY) * 0.7 },
                        { x: roomBounds.minX + (roomBounds.maxX - roomBounds.minX) * 0.3, y: roomBounds.minY + (roomBounds.maxY - roomBounds.minY) * 0.7 }
                    ];
                } else {
                    // 走廊等没有边界的情况，使用当前位置周围
                    enemy.patrolPath = [
                        { x: enemyX - 100, y: enemyY - 100 },
                        { x: enemyX + 100, y: enemyY - 100 },
                        { x: enemyX + 100, y: enemyY + 100 },
                        { x: enemyX - 100, y: enemyY + 100 }
                    ];
                }
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
            enemy.patrolIndex = 0;
            return;
        }
        
        // 限制敌人在房间内：先检查并调整目标点位置
        const roomBounds = this.getRoomBounds(enemy.room || 'corridor');
        let adjustedTargetX = currentTarget.x;
        let adjustedTargetY = currentTarget.y;
        
        if (roomBounds) {
            // 如果目标点在房间边界外，调整到边界内
            adjustedTargetX = Math.max(roomBounds.minX, Math.min(roomBounds.maxX, currentTarget.x));
            adjustedTargetY = Math.max(roomBounds.minY, Math.min(roomBounds.maxY, currentTarget.y));
            
            // 如果目标点被调整了，更新巡逻路径中的该点
            if (adjustedTargetX !== currentTarget.x || adjustedTargetY !== currentTarget.y) {
                enemy.patrolPath[enemy.patrolIndex] = { x: adjustedTargetX, y: adjustedTargetY };
            }
        }
        
        const distToTarget = Phaser.Math.Distance.Between(enemyX, enemyY, adjustedTargetX, adjustedTargetY);
        
        if (distToTarget < 50) {
            // 到达目标点，立即移动到下一个点（降低阈值确保不会卡住）
            enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrolPath.length;
        }
        
        // 获取新的目标点（如果刚刚切换了）
        const finalTarget = enemy.patrolPath[enemy.patrolIndex];
        if (!finalTarget) return;
        
        // 确保最终目标也在房间边界内
        let finalTargetX = finalTarget.x;
        let finalTargetY = finalTarget.y;
        if (roomBounds) {
            finalTargetX = Math.max(roomBounds.minX, Math.min(roomBounds.maxX, finalTarget.x));
            finalTargetY = Math.max(roomBounds.minY, Math.min(roomBounds.maxY, finalTarget.y));
        }
        
        // 向目标点移动（使用标准化速度向量，像玩家一样流畅）
        const angle = Phaser.Math.Angle.Between(enemyX, enemyY, finalTargetX, finalTargetY);
        const speed = enemy.speed * 0.6; // 巡逻速度稍慢
        
        // 标准化速度向量，确保斜向移动速度一致（像玩家一样）
        let velocityX = Math.cos(angle) * speed;
        let velocityY = Math.sin(angle) * speed;
        const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (magnitude > 0) {
            velocityX = (velocityX / magnitude) * speed;
            velocityY = (velocityY / magnitude) * speed;
        }
        
        // 最终边界检查：如果下一帧会超出房间边界，限制速度但保持移动
        if (roomBounds) {
            const nextX = enemyX + velocityX * 0.016; // 预测下一帧位置
            const nextY = enemyY + velocityY * 0.016;
            
            // 如果会超出边界，限制速度但保持最小移动（避免完全停止）
            if (nextX < roomBounds.minX || nextX > roomBounds.maxX) {
                // 如果朝向边界外，反向移动
                if ((nextX < roomBounds.minX && velocityX < 0) || (nextX > roomBounds.maxX && velocityX > 0)) {
                    velocityX = 0;
                }
            }
            if (nextY < roomBounds.minY || nextY > roomBounds.maxY) {
                // 如果朝向边界外，反向移动
                if ((nextY < roomBounds.minY && velocityY < 0) || (nextY > roomBounds.maxY && velocityY > 0)) {
                    velocityY = 0;
                }
            }
        }
        
        enemy.body.setVelocity(velocityX, velocityY);
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
        
        // 根据敌人类型调整追逐策略（使用标准化速度向量，像玩家一样流畅）
        let targetX = this.playerBody.x;
        let targetY = this.playerBody.y;
        let chaseSpeed = enemy.speed;
        
        switch (enemy.type) {
            case 'grunt':
                // 直接追逐
                break;
            
            case 'soldier':
                // 预测玩家移动
                const leadTime = 0.2; // 提前量
                const playerVelocity = this.playerBody.body?.velocity || { x: 0, y: 0 };
                targetX = this.playerBody.x + playerVelocity.x * leadTime;
                targetY = this.playerBody.y + playerVelocity.y * leadTime;
                chaseSpeed = enemy.speed * 1.1;
                break;
            
            case 'captain':
                // 战略性追逐 - 尝试包抄
                const angle3 = Phaser.Math.Angle.Between(enemyX, enemyY, this.playerBody.x, this.playerBody.y);
                const offsetAngle = (Math.random() - 0.5) * Math.PI / 3; // 随机偏移角度
                targetX = this.playerBody.x + Math.cos(angle3 + offsetAngle) * 100;
                targetY = this.playerBody.y + Math.sin(angle3 + offsetAngle) * 100;
                chaseSpeed = enemy.speed * 1.2;
                break;
            
            default:
                // 默认追逐行为
                break;
        }
        
        // 计算方向角度
        const chaseAngle = Phaser.Math.Angle.Between(enemyX, enemyY, targetX, targetY);
        
        // 标准化速度向量，确保斜向移动速度一致（像玩家一样）
        let velocityX = Math.cos(chaseAngle) * chaseSpeed;
        let velocityY = Math.sin(chaseAngle) * chaseSpeed;
        const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (magnitude > 0) {
            velocityX = (velocityX / magnitude) * chaseSpeed;
            velocityY = (velocityY / magnitude) * chaseSpeed;
        }
        
        // 限制敌人在房间内：检查目标位置是否在房间边界内
        const roomBounds = this.getRoomBounds(enemy.room || 'corridor');
        if (roomBounds) {
            const nextX = enemyX + velocityX * 0.016; // 预测下一帧位置（假设60fps）
            const nextY = enemyY + velocityY * 0.016;
            
            // 如果下一帧会超出房间边界，限制速度
            if (nextX < roomBounds.minX || nextX > roomBounds.maxX) {
                velocityX = 0;
            }
            if (nextY < roomBounds.minY || nextY > roomBounds.maxY) {
                velocityY = 0;
            }
        }
        
        enemy.body.setVelocity(velocityX, velocityY);
    }
    
    // 获取房间边界（用于限制敌人移动）
    private getRoomBounds(room: string): {minX: number, maxX: number, minY: number, maxY: number} | null {
        const gridSize = 80;
        const rooms: {[key: string]: {x: number, y: number, width: number, height: number}} = {
            start: { x: 15, y: 15, width: 15, height: 12 },
            left: { x: 15, y: 33, width: 12, height: 9 },
            main: { x: 36, y: 15, width: 18, height: 15 },
            right: { x: 60, y: 15, width: 12, height: 12 },
            treasure: { x: 36, y: 36, width: 15, height: 12 }
        };
        
        const roomDef = rooms[room];
        if (!roomDef) return null; // 走廊等没有边界限制
        
        const margin = 60; // 距离墙壁的安全边距（像素，增大以确保敌人不会卡在角落）
        return {
            minX: roomDef.x * gridSize + margin,
            maxX: (roomDef.x + roomDef.width) * gridSize - margin,
            minY: roomDef.y * gridSize + margin,
            maxY: (roomDef.y + roomDef.height) * gridSize - margin
        };
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
        
        // 射击冷却时间（根据敌人类型调整，BOSS射击更快）
        let attackCooldown = 2000;
        switch (enemy.type) {
            case 'grunt':
                attackCooldown = 2200; // 普通敌人射击较慢
                break;
            case 'soldier':
                attackCooldown = 1200; // 精英敌人射击较快
                break;
            case 'captain':
                attackCooldown = 800; // BOSS射击很快
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
    
    // 检查物品收集（改为按E键拾取）
    private checkItemCollection() {
        try {
            if (!this.playerBody) return;
            
            // 性能优化：只检查屏幕内的物品（视锥剔除）
            const camera = this.cameras.main;
            const camX = camera.scrollX;
            const camY = camera.scrollY;
            const camWidth = camera.width;
            const camHeight = camera.height;
            const viewBounds = {
                left: camX - 100,
                right: camX + camWidth + 100,
                top: camY - 100,
                bottom: camY + camHeight + 100
            };
            
            // 查找最近的物品
            let nearestItem: GameItem | null = null;
            let nearestDist = Infinity;
            const pickupRange = 50; // 拾取范围
            
            this.items.forEach(item => {
                if (!item.body) return;
                
                // 性能优化：只检查屏幕内的物品
                const itemX = item.x || item.body.x;
                const itemY = item.y || item.body.y;
                if (itemX < viewBounds.left || itemX > viewBounds.right ||
                    itemY < viewBounds.top || itemY > viewBounds.bottom) {
                    return; // 不在视野内
                }
                
                const dist = Phaser.Math.Distance.Between(
                    this.playerBody.x, this.playerBody.y,
                    itemX, itemY
                );
                
                // 检查是否在拾取范围内，且不是刚遗弃的物品（冷却时间1秒）
                const isRecentlyDropped = item.dropTime && (Date.now() - item.dropTime < 1000);
                
                if (dist < pickupRange && !isRecentlyDropped) {
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestItem = item;
                    }
                }
            });
            
            // 更新附近的物品
            const prevNearbyItem = this.nearbyItem;
            this.nearbyItem = nearestItem;
            
            // 显示或隐藏拾取提示
            if (this.nearbyItem) {
                // 显示拾取提示
                if (!this.pickupHintText || prevNearbyItem !== this.nearbyItem) {
                    // 移除旧的提示
                    if (this.pickupHintText) {
                        this.pickupHintText.destroy();
                    }
                    
                    // 创建新的提示
                    if (this.nearbyItem) {
                        const item = this.nearbyItem as GameItem;
                        const itemX = item.x || (item.body ? item.body.x : 0);
                        const itemY = item.y || (item.body ? item.body.y : 0);
                        
                        this.pickupHintText = this.add.text(
                            itemX - this.cameras.main.scrollX,
                            itemY - this.cameras.main.scrollY - 40,
                            '[ E ] 拾取',
                            {
                                fontSize: '18px',
                                color: '#ffffff',
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: { x: 10, y: 5 },
                                fontStyle: 'bold',
                                stroke: '#000000',
                                strokeThickness: 2
                            }
                        );
                        this.pickupHintText.setOrigin(0.5);
                        this.pickupHintText.setScrollFactor(0);
                        this.pickupHintText.setDepth(2000);
                    }
                } else {
                    // 更新提示位置
                    if (this.nearbyItem && this.pickupHintText) {
                        const item = this.nearbyItem as GameItem;
                        const itemX = item.x || (item.body ? item.body.x : 0);
                        const itemY = item.y || (item.body ? item.body.y : 0);
                        this.pickupHintText.x = itemX - this.cameras.main.scrollX;
                        this.pickupHintText.y = itemY - this.cameras.main.scrollY - 40;
                    }
                }
            } else {
                // 隐藏拾取提示
                if (this.pickupHintText) {
                    this.pickupHintText.destroy();
                    this.pickupHintText = null;
                }
            }
            
            // 检查E键按下，拾取物品（使用keydown事件，避免重复触发）
            if (this.nearbyItem && (this.keys as any).e && (this.keys as any).e.isDown) {
                if (!this.eKeyJustPressed) {
                    this.eKeyJustPressed = true;
                    this.pickupItem(this.nearbyItem);
                }
            } else {
                // 重置E键状态
                this.eKeyJustPressed = false;
            }
            
        } catch (error) {
            console.error('检查物品收集时出错:', error);
        }
    }
    
    // 拾取物品（按E键触发）
    private pickupItem(item: GameItem) {
        try {
            if (!item || !item.body) return;
            
            // 检查是否刚遗弃的物品（冷却时间1秒）
            if (item.dropTime && (Date.now() - item.dropTime < 1000)) {
                return; // 刚遗弃的物品不能立即拾取
            }
            
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
            
            // 移除拾取提示
            if (item.pickupHint) {
                item.pickupHint.destroy();
                item.pickupHint = null;
            }
            
            if (this.pickupHintText) {
                this.pickupHintText.destroy();
                this.pickupHintText = null;
            }
            
            // 移除图形和物理体
            item.graphic.destroy();
            item.body.destroy();
            
            // 从数组中移除
            const itemIndex = this.items.indexOf(item);
            if (itemIndex >= 0) {
                this.items.splice(itemIndex, 1);
            }
            
            // 清除附近的物品引用
            if (this.nearbyItem === item) {
                this.nearbyItem = null;
            }
            
        } catch (error) {
            console.error('拾取物品时出错:', error);
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
                    // 金钱堆叠：检查背包中是否已有金币，如果有就增加数量，否则添加新项
                    const existingMoneyIndex = this.playerBackpack.findIndex(
                        backpackItem => backpackItem.type === 'money'
                    );
                    if (existingMoneyIndex >= 0) {
                        // 已有金币，增加数量
                        const existingItem = this.playerBackpack[existingMoneyIndex];
                        existingItem.quantity = (existingItem.quantity || 1) + 1;
                        existingItem.value = (existingItem.value || 0) + (item.value || 0);
                        existingItem.name = `$${existingItem.value}`;
                    } else {
                        // 没有金币，添加新项
                        itemCopy.name = itemCopy.name || `$${item.value}`;
                        itemCopy.quantity = 1;
                        this.playerBackpack.push(itemCopy);
                        this.collectedItems++;
                    }
                    break;
                
                case 'medical':
                    // 医疗物品不再立即使用，只添加到背包，可以在背包中使用
                    // 记录到背包
                    this.playerBackpack.push(itemCopy);
                    this.collectedItems++;
                    break;
                
                case 'armor':
                    // 护甲不再立即使用，只添加到背包，可以在背包中装备
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
                    // 解锁相应的武器类型（四种武器：0-手枪, 1-步枪, 2-霰弹枪, 3-狙击枪）
                    let weaponIndex = -1;
                    
                    switch (item.subtype) {
                        case 'pistol':
                            weaponIndex = 0; // 手枪
                            break;
                        case 'rifle':
                            weaponIndex = 1; // 步枪
                            break;
                        case 'shotgun':
                            weaponIndex = 2; // 霰弹枪
                            break;
                        case 'sniper':
                            weaponIndex = 3; // 狙击枪
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
                    // 为相应武器类型添加弹药（四种武器：0-手枪, 1-步枪, 2-霰弹枪, 3-狙击枪）
                    let ammoWeaponIndex = -1;
                    // 使用物品的value作为弹药数量，如果没有则使用quantity
                    let ammoAmount = item.value || item.quantity || 10;
                    
                    switch (item.subtype) {
                        case 'pistol':
                            ammoWeaponIndex = 0; // 手枪
                            break;
                        case 'rifle':
                            ammoWeaponIndex = 1; // 步枪
                            break;
                        case 'shotgun':
                            ammoWeaponIndex = 2; // 霰弹枪
                            break;
                        case 'sniper':
                            ammoWeaponIndex = 3; // 狙击枪
                            break;
                        default:
                            // 默认添加所有武器的弹药
                            for (let i = 0; i < this.weapons.length; i++) {
                                this.addAmmo(i, Math.floor(ammoAmount * 0.5));
                            }
                            break;
                    }
                    
                    if (ammoWeaponIndex >= 0) {
                        // 添加弹药到对应武器
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
            // 确保敌人存在且有效
            if (!enemy || !enemy.body || enemy.health <= 0) {
                return;
            }
            
            // 确保生命值有效
            if (!enemy.maxHealth || enemy.health === undefined) {
                return;
            }
            
            // 扣除生命值
            enemy.health = Math.max(0, enemy.health - amount);
            
            // 更新血量条
            this.updateEnemyHealthBar(enemy);
            
            // 播放击中音效（根据伤害大小调整）
            this.playHitSound(amount);
            
            // 被击中效果
            enemy.isHit = true;
            enemy.hitTimer = 20; // 帧数
            
            // 变红效果 - 使用tint而不是清除图形，避免破坏敌人外观
            enemy.graphic.setTint(0xff0000);
            
            // 短暂变红后恢复
            this.time.delayedCall(150, () => {
                if (enemy && enemy.graphic) {
                    enemy.graphic.clearTint();
                }
            });
            
            // 被击中击退效果（根据伤害调整力度）
            const enemyX = enemy.body.x;
            const enemyY = enemy.body.y;
            const angle = Phaser.Math.Angle.Between(this.playerBody.x, this.playerBody.y, enemyX, enemyY);
            const knockbackForce = Math.min(50 + amount * 2, 150); // 伤害越大击退越强
            enemy.body.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );
            
            // 增强的击中特效
            // 主冲击波
            const hitEffect = this.add.graphics();
            hitEffect.fillStyle(0xffffff, 0.9);
            hitEffect.fillCircle(0, 0, 12);
            hitEffect.fillStyle(0xff0000, 0.7);
            hitEffect.fillCircle(0, 0, 8);
            hitEffect.setPosition(enemyX, enemyY);
            hitEffect.setDepth(65);
            
            this.tweens.add({
                targets: hitEffect,
                scale: { from: 0.3, to: 2 },
                alpha: { from: 0.9, to: 0 },
                duration: 250,
                ease: 'Power2.easeOut',
                onComplete: () => hitEffect.destroy()
            });
            
            // 血花粒子效果
            const bloodParticles = this.add.graphics();
            for (let i = 0; i < 6; i++) {
                const particleAngle = angle + Math.PI + (Math.random() - 0.5) * Math.PI;
                const particleDist = Math.random() * 15 + 8;
                const particleX = Math.cos(particleAngle) * particleDist;
                const particleY = Math.sin(particleAngle) * particleDist;
                
                // 血红色粒子
                const bloodColor = Phaser.Math.Between(0xcc0000, 0xff0000);
                bloodParticles.fillStyle(bloodColor, 1);
                bloodParticles.fillCircle(particleX, particleY, Math.random() * 2 + 1);
            }
            bloodParticles.setPosition(enemyX, enemyY);
            bloodParticles.setDepth(66);
            
            this.tweens.add({
                targets: bloodParticles,
                alpha: { from: 1, to: 0 },
                scale: { from: 1, to: 1.3 },
                duration: 300,
                ease: 'Power2.easeOut',
                onComplete: () => bloodParticles.destroy()
            });
            
            // 显示伤害数字
            this.showDamageNumber(enemyX, enemyY, amount);
            
            // 检查是否死亡（在updateEnemies中统一处理，避免重复调用）
            // 死亡检查已移至updateEnemies方法中统一处理
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
        
        this.playEnemyShootSound(enemy.type);
    }
    
    // 敌人射击音效（根据敌人类型调整）
    private playEnemyShootSound(enemyType?: string) {
        try {
            // 使用共享的AudioContext
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                } catch (e) {
                    console.warn('无法创建AudioContext:', e);
                    return;
                }
            }
            
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => {});
            }
            
            const audioContext = this.audioContext;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 根据敌人类型调整音效
            let frequency = 150;
            let volume = 0.08;
            
            switch (enemyType) {
                case 'captain':
                    frequency = 200; // BOSS射击音调更高
                    volume = 0.12;
                    break;
                case 'soldier':
                    frequency = 170; // 精英音调中等
                    volume = 0.1;
                    break;
                default:
                    frequency = 150; // 普通敌人音调较低
                    volume = 0.08;
                    break;
            }
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, audioContext.currentTime + 0.05);
            
            gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
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
    
    // 播放敌人死亡音效（根据敌人类型）
    private playEnemyDeathSound(enemyType: string) {
        try {
            const audioContext = this.getAudioContext();
            if (!audioContext) return;
            
            // 根据敌人类型创建不同音效
            let frequency = 200;
            let duration = 0.3;
            let volume = 0.15;
            
            switch (enemyType) {
                case 'captain':
                    // BOSS死亡 - 更深沉的爆炸声
                    frequency = 150;
                    duration = 0.5;
                    volume = 0.25;
                    break;
                case 'soldier':
                    // 精英死亡 - 中等音调
                    frequency = 180;
                    duration = 0.35;
                    volume = 0.18;
                    break;
                default:
                    // 普通敌人 - 较高音调
                    frequency = 200;
                    duration = 0.3;
                    volume = 0.15;
                    break;
            }
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.3, audioContext.currentTime + duration);
            
            gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
            
            oscillator.onended = () => {
                try {
                    oscillator.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // 忽略断开连接错误
                }
            };
            
        } catch (error) {
            console.error('播放敌人死亡音效时出错:', error);
        }
    }

    
    // 播放击中音效（根据伤害大小调整音调）
    private playHitSound(damage: number = 10) {
        try {
            const audioContext = this.getAudioContext();
            if (!audioContext) return;
            
            // 根据伤害调整音调（伤害越大音调越低，更有冲击感）
            const baseFreq = 300 - (damage * 5); // 基础频率随伤害降低
            const freq = Math.max(100, baseFreq); // 最低100Hz
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, audioContext.currentTime + 0.1);
            
            // 音量根据伤害调整
            const volume = Math.min(0.15 + (damage / 100), 0.4);
            gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
            
            oscillator.onended = () => {
                try {
                    oscillator.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // 忽略断开连接错误
                }
            };
            
        } catch (error) {
            console.error('播放击中音效时出错:', error);
        }
    }
    
    // 显示伤害数字
    private showDamageNumber(x: number, y: number, damage: number) {
        try {
            // 将世界坐标转换为屏幕坐标
            const screenX = x - this.cameras.main.scrollX;
            const screenY = y - this.cameras.main.scrollY - 20;
            
            const damageText = this.add.text(screenX, screenY, `-${Math.floor(damage)}`, {
                fontSize: '18px',
                color: '#ff0000',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 4,
                    stroke: true,
                    fill: true
                }
            });
            damageText.setOrigin(0.5);
            damageText.setScrollFactor(0);
            damageText.setDepth(1000);
            
            // 伤害数字动画（向上飘并淡出）
            this.tweens.add({
                targets: damageText,
                y: screenY - 40,
                alpha: { from: 1, to: 0 },
                scale: { from: 1, to: 1.3 },
                duration: 600,
                ease: 'Power2.easeOut',
                onComplete: () => damageText.destroy()
            });
            
        } catch (error) {
            console.error('显示伤害数字时出错:', error);
        }
    }
    
    // 播放墙壁击中音效
    private playWallHitSound() {
        try {
            const audioContext = this.getAudioContext();
            if (!audioContext) return;
            
            // 金属撞击声
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.08);
            
            gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            
            oscillator.onended = () => {
                try {
                    oscillator.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // 忽略断开连接错误
                }
            };
            
        } catch (error) {
            console.error('播放墙壁击中音效时出错:', error);
        }
    }
    
    // 音效方法（预留，未来可能使用）
    // 这些方法已预留但当前未使用，保留以备将来扩展
    
    // 播放撤离音效
    private playEvacuationSound() {
        try {
            this.sound.play('evacuationSound', { volume: 0.5 });
        } catch (error) {
            console.error('播放撤离音效时出错:', error);
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


    
    
    // 完成撤离
    private completeEvacuation() {
        try {
            // 停止所有撤离点的倒计时
            this.evacuationPoints.forEach(evacPoint => {
                this.stopEvacuationCountdown(evacPoint);
            });
            
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
    
    // 玩家撤离（已整合到completeEvacuation方法中）
    // 此方法已废弃，保留仅用于兼容
    // @deprecated 使用 completeEvacuation() 代替

    
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
        // 更新状态
        this.isInventoryOpen = true;
        
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
            
            // 如果槽位有物品，根据物品稀有度设置背景颜色
            let slotBgColor = 0x2c3e50; // 默认灰色
            let slotBorderColor = 0x34495e; // 默认边框颜色
            
            if (i < this.playerBackpack.length) {
                const item = this.playerBackpack[i];
                slotBgColor = this.getRarityBackgroundColor(item.rarity);
                slotBorderColor = this.getRarityBorderColor(item.rarity);
            }
            
            slot.fillStyle(slotBgColor, 0.8);
            slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            slot.lineStyle(2, slotBorderColor, 0.6);
            slot.strokeRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            slot.setScrollFactor(0);
            slot.setInteractive(new Phaser.Geom.Rectangle(slotX, slotY, slotSize, slotSize), Phaser.Geom.Rectangle.Contains);
            
            // 槽位交互效果
            slot.on('pointerover', () => {
                slot.clear();
                slot.fillStyle(slotBgColor, 0.9);
                slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 8);
                slot.lineStyle(3, 0xf39c12);
                slot.strokeRoundedRect(slotX, slotY, slotSize, slotSize, 8);
            });
            
            slot.on('pointerout', () => {
                slot.clear();
                slot.fillStyle(slotBgColor, 0.8);
                slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 8);
                slot.lineStyle(2, slotBorderColor, 0.6);
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
    
    // 获取稀有度对应的背景颜色
    private getRarityBackgroundColor(rarity?: ItemRarity): number {
        if (!rarity) return 0x2c3e50; // 默认灰色
        
        switch (rarity) {
            case ItemRarity.COMMON:
                return 0x2c3e50; // 灰色（普通）
            case ItemRarity.UNCOMMON:
                return 0x2ecc71; // 绿色（不常见）
            case ItemRarity.RARE:
                return 0x3498db; // 蓝色（稀有）
            case ItemRarity.EPIC:
                return 0x9b59b6; // 紫色（史诗）
            case ItemRarity.LEGENDARY:
                return 0xf39c12; // 金色（传说）
            default:
                return 0x2c3e50;
        }
    }
    
    // 获取稀有度对应的边框颜色
    private getRarityBorderColor(rarity?: ItemRarity): number {
        if (!rarity) return 0x34495e;
        
        switch (rarity) {
            case ItemRarity.COMMON:
                return 0x34495e; // 深灰色
            case ItemRarity.UNCOMMON:
                return 0x27ae60; // 深绿色
            case ItemRarity.RARE:
                return 0x2980b9; // 深蓝色
            case ItemRarity.EPIC:
                return 0x8e44ad; // 深紫色
            case ItemRarity.LEGENDARY:
                return 0xe67e22; // 深金色
            default:
                return 0x34495e;
        }
    }
    
    // 在背包槽位中创建物品
    private createBackpackItemInSlot(centerX: number, centerY: number, item: GameItem, _slotIndex: number) {
        if (!this.inventoryPanel) return;
        
        // 创建物品容器
        const itemContainer = this.add.container(centerX, centerY);
        itemContainer.setScrollFactor(0);
        
        // 根据稀有度创建背景
        const rarityBg = this.add.graphics();
        const bgColor = this.getRarityBackgroundColor(item.rarity);
        const borderColor = this.getRarityBorderColor(item.rarity);
        
        // 背景圆形（根据稀有度）
        rarityBg.fillStyle(bgColor, 0.9);
        rarityBg.fillCircle(0, 0, 35);
        rarityBg.lineStyle(3, borderColor, 1);
        rarityBg.strokeCircle(0, 0, 35);
        
        // 如果是传说物品，添加发光效果
        if (item.rarity === ItemRarity.LEGENDARY) {
            rarityBg.lineStyle(2, 0xffd700, 0.6);
            rarityBg.strokeCircle(0, 0, 38);
        }
        
        itemContainer.add(rarityBg);
        
        // 获取物品颜色
        const itemColor = this.getItemColorForType(item.type);
        
        // 创建物品图标（在稀有度背景之上）
        const itemIcon = this.add.graphics();
        itemIcon.fillStyle(itemColor);
        itemIcon.fillCircle(0, 0, 25);
        itemIcon.lineStyle(2, 0xecf0f1);
        itemIcon.strokeCircle(0, 0, 25);
        
        // 物品名称（简化显示）
        const itemName = item.name || this.getItemTypeName(item.type);
        const itemText = this.add.text(0, -25, itemName.length > 6 ? itemName.substring(0, 6) + '...' : itemName, {
            font: 'bold 10px Arial',
            color: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 1
        });
        itemText.setOrigin(0.5);
        
        // 物品数量或医疗物品剩余治疗量
        let centerText: Phaser.GameObjects.Text;
        if (item.type === 'medical' && item.maxDurability) {
            // 医疗物品显示剩余治疗量/最大治疗量（更明显的显示）
            const remainingHeal = item.value || 0;
            const maxHeal = item.maxDurability;
            centerText = this.add.text(0, -5, `${remainingHeal}/${maxHeal}`, {
                font: 'bold 16px Arial',
                color: remainingHeal > 0 ? '#2ecc71' : '#e74c3c',
                stroke: '#000000',
                strokeThickness: 3
            });
        } else {
            // 其他物品显示数量
            centerText = this.add.text(0, 0, `${item.quantity || 1}`, {
                font: 'bold 16px Arial',
                color: '#f39c12',
                stroke: '#2c3e50',
                strokeThickness: 2
            });
        }
        centerText.setOrigin(0.5);
        
        // 物品价值（医疗物品显示HP标识）
        let valueText: Phaser.GameObjects.Text;
        if (item.type === 'medical') {
            // 医疗物品显示HP标识（更明显）
            valueText = this.add.text(0, 20, 'HP', {
                font: 'bold 12px Arial',
                color: '#2ecc71',
                stroke: '#000000',
                strokeThickness: 2
            });
        } else {
            // 其他物品显示价值
            valueText = this.add.text(0, 25, `$${item.value || 0}`, {
                font: 'bold 10px Arial',
                color: '#2ecc71',
                stroke: '#2c3e50',
                strokeThickness: 1
            });
        }
        valueText.setOrigin(0.5);
        
        // 将所有元素添加到容器
        itemContainer.add([itemIcon, itemText, centerText, valueText]);
        itemContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
        
        // 悬停效果
        itemContainer.on('pointerover', () => {
            itemContainer.setScale(1.15);
                        this.input.setDefaultCursor('pointer');
            // 显示详细信息（传递槽位索引）
            this.showItemDetails(item, centerX + 50, centerY, _slotIndex);
        });
        
        itemContainer.on('pointerout', () => {
            itemContainer.setScale(1);
                        this.input.setDefaultCursor('default');
                    });
        
        itemContainer.on('pointerdown', () => {
            this.showItemDetails(item, centerX + 50, centerY, _slotIndex);
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
    private showItemDetails(item: GameItem, x: number, y: number, slotIndex?: number) {
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
        // 如果有使用按钮或遗弃按钮，增加高度
        const hasUseButton = item.type === 'armor' || item.type === 'weapon' || item.type === 'medical';
        const panelHeight = hasUseButton ? 350 : 250; // 增加高度以容纳遗弃按钮
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
        
        const details: Array<{label: string, value: string, color: string}> = [
            { label: '类型', value: this.getItemTypeName(item.type), color: '#3498db' }
        ];
        
        // 优先显示稀有度（重要信息）
        if (item.rarity) {
            const rarityNames = {
                common: '普通',
                uncommon: '不常见',
                rare: '稀有',
                epic: '史诗',
                legendary: '传说'
            };
            const rarityName = rarityNames[item.rarity as keyof typeof rarityNames] || item.rarity;
            // 根据稀有度设置颜色
            let rarityColor = '#9b59b6';
            switch (item.rarity) {
                case ItemRarity.COMMON:
                    rarityColor = '#95a5a6'; // 灰色
                    break;
                case ItemRarity.UNCOMMON:
                    rarityColor = '#2ecc71'; // 绿色
                    break;
                case ItemRarity.RARE:
                    rarityColor = '#3498db'; // 蓝色
                    break;
                case ItemRarity.EPIC:
                    rarityColor = '#9b59b6'; // 紫色
                    break;
                case ItemRarity.LEGENDARY:
                    rarityColor = '#f39c12'; // 金色
                    break;
            }
            details.push({ label: '稀有度', value: rarityName, color: rarityColor });
        }
        
        // 医疗物品显示治疗量信息
        if (item.type === 'medical' && item.maxDurability) {
            const remainingHeal = item.value || 0;
            const maxHeal = item.maxDurability;
            details.push({ label: '总治疗量', value: `${maxHeal} HP`, color: '#2ecc71' });
            details.push({ label: '剩余治疗量', value: `${remainingHeal}/${maxHeal} HP`, color: remainingHeal > 0 ? '#2ecc71' : '#e74c3c' });
        } else {
            details.push({ label: '数量', value: `${item.quantity || 1}`, color: '#2ecc71' });
        }
        
        // 非医疗物品显示价值
        if (item.type !== 'medical') {
            details.push({ label: '价值', value: `$${item.value || 0}`, color: '#f1c40f' });
        }
        
        details.push({ label: '重量', value: `${item.weight || 0} kg`, color: '#95a5a6' });
        
        // 添加特殊属性
        if (item.type === 'weapon' && item.subtype) {
            details.push({ label: '武器类型', value: item.subtype, color: '#e74c3c' });
        }
        if (item.type === 'ammo' && item.subtype) {
            details.push({ label: '弹药类型', value: item.subtype, color: '#e67e22' });
        }
        if (item.durability !== undefined && item.maxDurability && item.type !== 'medical') {
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
        
        // 使用按钮（对护甲、武器和医疗物品显示）
        let useButton: Phaser.GameObjects.Text | null = null;
        if (item.type === 'armor' || item.type === 'weapon' || item.type === 'medical') {
            const buttonY = panelY + panelHeight - 70;
            
            // 使用按钮背景
            const useButtonBg = this.add.graphics();
            useButtonBg.fillStyle(0x2ecc71, 0.8);
            useButtonBg.fillRoundedRect(panelX + 20, buttonY - 5, panelWidth - 40, 35, 8);
            useButtonBg.lineStyle(2, 0x27ae60, 1);
            useButtonBg.strokeRoundedRect(panelX + 20, buttonY - 5, panelWidth - 40, 35, 8);
            useButtonBg.setScrollFactor(0);
            detailPanel.add(useButtonBg);
            
            // 使用按钮文本
            let buttonText = '';
            if (item.type === 'armor') {
                buttonText = '🛡 装备护甲';
            } else if (item.type === 'weapon') {
                buttonText = '🔫 装备武器';
            } else if (item.type === 'medical') {
                buttonText = '💊 使用医疗';
            }
            useButton = this.add.text(panelX + panelWidth / 2, buttonY + 12, buttonText, {
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            useButton.setOrigin(0.5);
            useButton.setScrollFactor(0);
            useButton.setInteractive({ useHandCursor: true });
            useButton.on('pointerover', () => {
                useButton?.setColor('#ffff00');
                useButtonBg.clear();
                useButtonBg.fillStyle(0x27ae60, 0.9);
                useButtonBg.fillRoundedRect(panelX + 20, buttonY - 5, panelWidth - 40, 35, 8);
                useButtonBg.lineStyle(2, 0x2ecc71, 1);
                useButtonBg.strokeRoundedRect(panelX + 20, buttonY - 5, panelWidth - 40, 35, 8);
            });
            useButton.on('pointerout', () => {
                useButton?.setColor('#ffffff');
                useButtonBg.clear();
                useButtonBg.fillStyle(0x2ecc71, 0.8);
                useButtonBg.fillRoundedRect(panelX + 20, buttonY - 5, panelWidth - 40, 35, 8);
                useButtonBg.lineStyle(2, 0x27ae60, 1);
                useButtonBg.strokeRoundedRect(panelX + 20, buttonY - 5, panelWidth - 40, 35, 8);
            });
            useButton.on('pointerdown', () => {
                // 找到物品在背包中的索引
                const itemIndex = slotIndex !== undefined ? slotIndex : this.playerBackpack.findIndex(backpackItem => 
                    backpackItem.id === item.id || 
                    (backpackItem.type === item.type && backpackItem.subtype === item.subtype && backpackItem.name === item.name)
                );
                
                if (itemIndex >= 0) {
                    this.useItemFromBackpack(itemIndex);
                    detailPanel.destroy();
                    (this as any).itemDetailPanel = null;
                    // 刷新背包界面
                    this.closeInventory();
                    this.toggleInventory();
                }
            });
            detailPanel.add(useButton);
        }
        
        // 遗弃按钮（所有物品都可以遗弃）
        const dropButtonY = hasUseButton ? panelY + panelHeight - 110 : panelY + panelHeight - 70;
        
        // 遗弃按钮背景
        const dropButtonBg = this.add.graphics();
        dropButtonBg.fillStyle(0xe74c3c, 0.8);
        dropButtonBg.fillRoundedRect(panelX + 20, dropButtonY - 5, panelWidth - 40, 35, 8);
        dropButtonBg.lineStyle(2, 0xc0392b, 1);
        dropButtonBg.strokeRoundedRect(panelX + 20, dropButtonY - 5, panelWidth - 40, 35, 8);
        dropButtonBg.setScrollFactor(0);
        detailPanel.add(dropButtonBg);
        
        // 遗弃按钮文本
        const dropButton = this.add.text(panelX + panelWidth / 2, dropButtonY + 12, '🗑️ 遗弃物品', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        dropButton.setOrigin(0.5);
        dropButton.setScrollFactor(0);
        dropButton.setInteractive({ useHandCursor: true });
        dropButton.on('pointerover', () => {
            dropButton.setColor('#ffff00');
            dropButtonBg.clear();
            dropButtonBg.fillStyle(0xc0392b, 0.9);
            dropButtonBg.fillRoundedRect(panelX + 20, dropButtonY - 5, panelWidth - 40, 35, 8);
            dropButtonBg.lineStyle(2, 0xe74c3c, 1);
            dropButtonBg.strokeRoundedRect(panelX + 20, dropButtonY - 5, panelWidth - 40, 35, 8);
        });
        dropButton.on('pointerout', () => {
            dropButton.setColor('#ffffff');
            dropButtonBg.clear();
            dropButtonBg.fillStyle(0xe74c3c, 0.8);
            dropButtonBg.fillRoundedRect(panelX + 20, dropButtonY - 5, panelWidth - 40, 35, 8);
            dropButtonBg.lineStyle(2, 0xc0392b, 1);
            dropButtonBg.strokeRoundedRect(panelX + 20, dropButtonY - 5, panelWidth - 40, 35, 8);
        });
        dropButton.on('pointerdown', () => {
            // 找到物品在背包中的索引
            const itemIndex = slotIndex !== undefined ? slotIndex : this.playerBackpack.findIndex(backpackItem => 
                backpackItem.id === item.id || 
                (backpackItem.type === item.type && backpackItem.subtype === item.subtype && backpackItem.name === item.name)
            );
            
            if (itemIndex >= 0) {
                this.dropItemFromBackpack(itemIndex);
                detailPanel.destroy();
                (this as any).itemDetailPanel = null;
                // 刷新背包界面
                this.closeInventory();
                this.toggleInventory();
            }
        });
        detailPanel.add(dropButton);
        
        // 关闭按钮
        const closeButtonY = hasUseButton ? panelY + panelHeight - 30 : panelY + panelHeight - 25;
        const closeButton = this.add.text(panelX + panelWidth / 2, closeButtonY, '[ 点击关闭 ]', {
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
        
        // 更新状态
        this.isInventoryOpen = false;
        
        // 恢复游戏时的鼠标样式
        this.input.setDefaultCursor('none');
        
        // 恢复游戏
        this.physics.resume();
    }
    
    // 从背包遗弃物品
    private dropItemFromBackpack(itemIndex: number) {
        try {
            if (itemIndex < 0 || itemIndex >= this.playerBackpack.length) {
                console.warn('无效的物品索引:', itemIndex);
                return;
            }
            
            const item = this.playerBackpack[itemIndex];
            
            if (!this.playerBody) {
                console.warn('玩家不存在，无法遗弃物品');
                return;
            }
            
            // 在玩家位置创建掉落物品
            const dropX = this.playerBody.x;
            const dropY = this.playerBody.y;
            
            // 创建物品定义（保持原有属性）
            const itemDef: any = {
                x: dropX,
                y: dropY,
                type: item.type,
                value: item.value,
                name: item.name,
                subtype: item.subtype,
                rarity: item.rarity,
                weight: item.weight,
                quantity: item.quantity,
                maxDurability: item.maxDurability,
                dropTime: Date.now() // 记录掉落时间，防止立即拾取
            };
            
            // 如果是医疗物品，保持剩余治疗量
            if (item.type === 'medical' && item.maxDurability) {
                itemDef.value = item.value; // 剩余治疗量
                itemDef.maxDurability = item.maxDurability; // 最大治疗量
            }
            
            // 生成唯一索引
            const index = this.items.length;
            
            // 创建掉落物品
            const droppedItem = this.createGameItem(itemDef, index);
            
            if (droppedItem) {
                this.items.push(droppedItem);
                
                // 添加掉落动画效果
                if (droppedItem.body) {
                    // 随机初速度（向上弹跳）
                    const bounceAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 3;
                    const bounceForce = 100 + Math.random() * 50;
                    droppedItem.body.setVelocity(
                        Math.cos(bounceAngle) * bounceForce,
                        Math.sin(bounceAngle) * bounceForce
                    );
                    
                    // 添加旋转动画
                    if (droppedItem.graphic) {
                        this.tweens.add({
                            targets: droppedItem.graphic,
                            angle: 360,
                            duration: 2000,
                            repeat: -1,
                            ease: 'Linear'
                        });
                    }
                    
                    // 添加衰减的弹跳动画
                    this.tweens.add({
                        targets: droppedItem.body,
                        velocityX: 0,
                        velocityY: 0,
                        duration: 1000,
                        ease: 'Power2.easeOut'
                    });
                }
                
                // 显示遗弃提示
                const dropText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2 - 50,
                    `🗑️ 已遗弃: ${item.name || this.getItemTypeName(item.type)}`,
                    {
                        fontSize: '20px',
                        color: '#e74c3c',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { x: 20, y: 10 }
                    }
                );
                dropText.setOrigin(0.5);
                dropText.setScrollFactor(0);
                dropText.setDepth(3000);
                
                this.tweens.add({
                    targets: dropText,
                    alpha: { from: 1, to: 0 },
                    y: dropText.y - 30,
                    duration: 2000,
                    onComplete: () => dropText.destroy()
                });
            }
            
            // 从背包移除
            this.playerBackpack.splice(itemIndex, 1);
            
        } catch (error) {
            console.error('遗弃物品时出错:', error);
        }
    }
    
    // 快速使用医疗物品（按H键）
    private useMedicalItem() {
        try {
            // 查找背包中的第一个医疗物品
            const medicalIndex = this.playerBackpack.findIndex(item => item.type === 'medical');
            
            if (medicalIndex === -1) {
                // 没有医疗物品，显示提示
                const noItemText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2 - 50,
                    '💊 背包中没有医疗物品',
                    {
                        fontSize: '20px',
                        color: '#95a5a6',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { x: 20, y: 10 }
                    }
                );
                noItemText.setOrigin(0.5);
                noItemText.setScrollFactor(0);
                noItemText.setDepth(3000);
                
                this.tweens.add({
                    targets: noItemText,
                    alpha: { from: 1, to: 0 },
                    y: noItemText.y - 30,
                    duration: 2000,
                    onComplete: () => noItemText.destroy()
                });
                return;
            }
            
            // 使用找到的医疗物品
            this.useItemFromBackpack(medicalIndex);
        } catch (error) {
            console.error('使用医疗物品时出错:', error);
        }
    }
    
    // 从背包使用物品
    private useItemFromBackpack(itemIndex: number) {
        try {
            if (itemIndex < 0 || itemIndex >= this.playerBackpack.length) {
                console.warn('无效的物品索引:', itemIndex);
                return;
            }
            
            const item = this.playerBackpack[itemIndex];
            
            if (item.type === 'armor') {
                // 装备护甲：根据稀有度增加护甲值，然后从背包移除
                const armorValue = this.getArmorValueByRarity(item.rarity || ItemRarity.COMMON);
                this.playerArmor = Math.min(this.playerArmor + armorValue, 100);
                this.updateArmorBar();
                
                // 显示装备提示
                const rarityNames: { [key: string]: string } = {
                    'common': '普通',
                    'uncommon': '不常见',
                    'rare': '稀有',
                    'epic': '史诗',
                    'legendary': '传说'
                };
                const rarityName = rarityNames[item.rarity || 'common'] || '未知';
                
                const equipText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2 - 50,
                    `🛡 已装备${rarityName}护甲！护甲值 +${armorValue}`,
                    {
                        fontSize: '24px',
                        color: '#3498db',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { x: 20, y: 10 }
                    }
                );
                equipText.setOrigin(0.5);
                equipText.setScrollFactor(0);
                equipText.setDepth(3000);
                
                this.tweens.add({
                    targets: equipText,
                    alpha: { from: 1, to: 0 },
                    y: equipText.y - 30,
                    duration: 2000,
                    onComplete: () => equipText.destroy()
                });
                
                // 从背包移除（护甲只能使用一次）
                this.playerBackpack.splice(itemIndex, 1);
                
            } else if (item.type === 'medical') {
                // 使用医疗物品：部分使用机制，按实际需求消耗
                const remainingHeal = item.value || 0; // 剩余治疗量
                const maxHeal = item.maxDurability || remainingHeal; // 最大治疗量
                
                if (remainingHeal <= 0) {
                    // 已经用完了，从背包移除
                    this.playerBackpack.splice(itemIndex, 1);
                    return;
                }
                
                const healthNeeded = this.playerMaxHealth - this.playerHealth; // 需要的治疗量
                const actualHeal = Math.min(remainingHeal, healthNeeded); // 实际治疗量（不超过剩余治疗量和需要的治疗量）
                
                if (actualHeal <= 0) {
                    // 生命值已满，不需要治疗
                    const fullText = this.add.text(
                        this.cameras.main.width / 2,
                        this.cameras.main.height / 2 - 50,
                        '💊 生命值已满，无需使用',
                        {
                            fontSize: '20px',
                            color: '#95a5a6',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: { x: 20, y: 10 }
                        }
                    );
                    fullText.setOrigin(0.5);
                    fullText.setScrollFactor(0);
                    fullText.setDepth(3000);
                    
                    this.tweens.add({
                        targets: fullText,
                        alpha: { from: 1, to: 0 },
                        y: fullText.y - 30,
                        duration: 2000,
                        onComplete: () => fullText.destroy()
                    });
                    return;
                }
                
                // 恢复生命值
                this.playerHealth = Math.min(this.playerHealth + actualHeal, this.playerMaxHealth);
                this.updateHealthBar();
                
                // 减少剩余治疗量
                item.value = remainingHeal - actualHeal;
                
                // 显示治疗提示
                const remainingText = item.value > 0 ? ` (剩余 ${item.value}/${maxHeal})` : ' (已用完)';
                const healText = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height / 2 - 50,
                    `💊 使用医疗物品！生命值 +${actualHeal}${remainingText}`,
                    {
                        fontSize: '24px',
                        color: '#2ecc71',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: { x: 20, y: 10 }
                    }
                );
                healText.setOrigin(0.5);
                healText.setScrollFactor(0);
                healText.setDepth(3000);
                
                // 添加治疗特效
                const healEffect = this.add.text(
                    this.playerBody.x - this.cameras.main.scrollX,
                    this.playerBody.y - this.cameras.main.scrollY - 30,
                    `+${actualHeal} HP`,
                    {
                        fontSize: '20px',
                        color: '#00ff00',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        fontStyle: 'bold'
                    }
                );
                healEffect.setOrigin(0.5);
                healEffect.setScrollFactor(0);
                healEffect.setDepth(3000);
                
                this.tweens.add({
                    targets: healEffect,
                    y: healEffect.y - 30,
                    alpha: { from: 1, to: 0 },
                    duration: 1000,
                    onComplete: () => healEffect.destroy()
                });
                
                this.tweens.add({
                    targets: healText,
                    alpha: { from: 1, to: 0 },
                    y: healText.y - 30,
                    duration: 2000,
                    onComplete: () => healText.destroy()
                });
                
                // 如果剩余治疗量为0，从背包移除
                if (item.value <= 0) {
                    this.playerBackpack.splice(itemIndex, 1);
                } else {
                    // 刷新背包界面以显示更新后的剩余治疗量
                    this.closeInventory();
                    this.toggleInventory();
                }
                
            } else if (item.type === 'weapon') {
                // 装备武器：替换当前武器，然后从背包移除
                let weaponIndex = -1;
                
                // 根据武器子类型确定武器索引
                switch (item.subtype) {
                    case 'pistol':
                        weaponIndex = 0; // 手枪
                        break;
                    case 'rifle':
                        weaponIndex = 1; // 步枪
                        break;
                    case 'shotgun':
                        weaponIndex = 2; // 霰弹枪
                        break;
                    case 'sniper':
                        weaponIndex = 3; // 狙击枪
                        break;
                }
                
                if (weaponIndex >= 0 && weaponIndex < this.weapons.length) {
                    const weapon = this.weapons[weaponIndex];
                    
                    // 为新武器添加初始弹药（根据武器类型设置）
                    if (weapon.currentAmmo === 0 && weapon.reserveAmmo === 0) {
                        weapon.currentAmmo = weapon.ammoCapacity; // 初始弹匣满弹
                        
                        // 根据武器类型设置备弹（测试模式）
                        if (weaponIndex === 0) {
                            // 手枪：100发备弹
                            weapon.reserveAmmo = 100;
                        } else {
                            // 其他武器：无备弹（只有初始弹匣）
                            weapon.reserveAmmo = 0;
                        }
                    }
                    
                    // 切换到新武器
                    this.switchWeapon(weaponIndex);
                    
                    // 显示装备提示
                    const ammoInfo = `（弹匣: ${weapon.currentAmmo} | 备弹: ${weapon.reserveAmmo}）`;
                    
                    const equipText = this.add.text(
                        this.cameras.main.width / 2,
                        this.cameras.main.height / 2 - 50,
                        `🔫 已装备武器: ${weapon.name}! ${ammoInfo}`,
                        {
                            fontSize: '22px',
                            color: '#e74c3c',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: { x: 20, y: 10 }
                        }
                    );
                    equipText.setOrigin(0.5);
                    equipText.setScrollFactor(0);
                    equipText.setDepth(3000);
                    
                    this.tweens.add({
                        targets: equipText,
                        alpha: { from: 1, to: 0 },
                        y: equipText.y - 30,
                        duration: 2000,
                        onComplete: () => equipText.destroy()
                    });
                    
                    // 从背包移除
                    this.playerBackpack.splice(itemIndex, 1);
                    
                    // 刷新背包显示
                    if (this.isInventoryOpen) {
                        this.closeInventory();
                        this.toggleInventory();
                    }
                } else {
                    console.warn('无效的武器类型:', item.subtype);
                }
            }
            
        } catch (error) {
            console.error('使用背包物品时出错:', error);
        }
    }
    
    // 消灭敌人
    private killEnemy(enemy: any) {
        try {
            // 如果敌人已经处理过，直接返回
            if (!enemy || enemy._isDead) return;
            enemy._isDead = true; // 标记为已死亡，避免重复处理
            
            // 使用物理体的实际位置
            const enemyX = enemy.body?.x || enemy.x || 0;
            const enemyY = enemy.body?.y || enemy.y || 0;
            
            // 立即隐藏所有视觉元素
            if (enemy.graphic) {
                enemy.graphic.setVisible(false);
                enemy.graphic.setActive(false);
            }
            if (enemy.eyeGraphic) {
                enemy.eyeGraphic.setVisible(false);
                enemy.eyeGraphic.setActive(false);
            }
            if (enemy.healthBarBg) {
                enemy.healthBarBg.setVisible(false);
                enemy.healthBarBg.setActive(false);
            }
            if (enemy.healthBar) {
                enemy.healthBar.setVisible(false);
                enemy.healthBar.setActive(false);
            }
            if (enemy.typeLabel) {
                enemy.typeLabel.setVisible(false);
                enemy.typeLabel.setActive(false);
            }
            
            // 增强的死亡特效
            const deathColor = this.getEnemyAttackColor(enemy.type || 'grunt');
            
            // 外层爆炸环
            const deathEffectOuter = this.add.graphics();
            deathEffectOuter.fillStyle(deathColor, 0.6);
            deathEffectOuter.fillCircle(0, 0, 35);
            deathEffectOuter.setPosition(enemyX, enemyY);
            deathEffectOuter.setDepth(65);
            
            this.tweens.add({
                targets: deathEffectOuter,
                scale: { from: 0.5, to: 3 },
                alpha: { from: 0.6, to: 0 },
                duration: 600,
                ease: 'Power2.easeOut',
                onComplete: () => deathEffectOuter.destroy()
            });
            
            // 内层爆炸
            const deathEffectInner = this.add.graphics();
            deathEffectInner.fillStyle(0xffffff, 0.9);
            deathEffectInner.fillCircle(0, 0, 25);
            deathEffectInner.fillStyle(deathColor, 0.8);
            deathEffectInner.fillCircle(0, 0, 20);
            deathEffectInner.setPosition(enemyX, enemyY);
            deathEffectInner.setDepth(66);
            
            this.tweens.add({
                targets: deathEffectInner,
                scale: { from: 0.3, to: 2.5 },
                alpha: { from: 0.9, to: 0 },
                duration: 500,
                ease: 'Power2.easeOut',
                onComplete: () => deathEffectInner.destroy()
            });
            
            // 爆炸粒子效果
            const explosionParticles = this.add.graphics();
            for (let i = 0; i < 16; i++) {
                const particleAngle = (Math.PI * 2 / 16) * i;
                const particleDist = Math.random() * 30 + 20;
                const particleX = Math.cos(particleAngle) * particleDist;
                const particleY = Math.sin(particleAngle) * particleDist;
                
                explosionParticles.fillStyle(deathColor, 1);
                explosionParticles.fillCircle(particleX, particleY, Math.random() * 3 + 2);
            }
            explosionParticles.setPosition(enemyX, enemyY);
            explosionParticles.setDepth(67);
            
            this.tweens.add({
                targets: explosionParticles,
                alpha: { from: 1, to: 0 },
                scale: { from: 1, to: 1.5 },
                duration: 400,
                ease: 'Power2.easeOut',
                onComplete: () => explosionParticles.destroy()
            });
            
            // 播放死亡音效
            this.playEnemyDeathSound(enemy.type || 'grunt');
            
            // 掉落金钱
            const moneyAmount = Phaser.Math.Between(10, 50);
            this.addGameItem(enemyX, enemyY, {
                type: 'money',
                value: moneyAmount
            });
            
            // 更新统计
            this.enemiesKilled++;
            
            // 销毁所有敌人相关的对象
            if (enemy.graphic) enemy.graphic.destroy();
            if (enemy.body) enemy.body.destroy();
            if (enemy.eyeGraphic) enemy.eyeGraphic.destroy();
            if (enemy.healthBarBg) enemy.healthBarBg.destroy();
            if (enemy.healthBar) enemy.healthBar.destroy();
            if (enemy.typeLabel) enemy.typeLabel.destroy();
            
            // 停止所有动画
            if (enemy.stateVisualTween) {
                enemy.stateVisualTween.stop();
                enemy.stateVisualTween = null;
            }
            
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
                this.addGameItem(enemyX, enemyY, randomItem);
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
                        // 使用原始delta确保倒计时准确，不受调用频率影响
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
            
            // 如果撤离点系统未激活，显示提示
            if (!this.evacuationAvailable) {
                this.evacuationPoints.forEach(evacPoint => {
                    const dist = Phaser.Math.Distance.Between(
                        this.playerBody.x, this.playerBody.y,
                        evacPoint.x, evacPoint.y
                    );
                    
                    if (dist < (evacPoint.radius || 120) + 50) {
                        this.evacuationText?.setText('撤离点未激活\n前往中央大厅激活撤离开关');
                        return;
                    }
                });
                return;
            }
            
            // 撤离点系统已激活，检查每个撤离点
            let playerNearAnyEvacPoint = false;
            
            this.evacuationPoints.forEach(evacPoint => {
                const dist = Phaser.Math.Distance.Between(
                    this.playerBody.x, this.playerBody.y,
                    evacPoint.x, evacPoint.y
                );
                
                // 使用撤离点的实际半径（默认120px）
                const evacRadius = evacPoint.radius || 120;
                
                // 检查是否在撤离点范围内
                if (dist < evacRadius) {
                    playerNearAnyEvacPoint = true;
                    
                    // 如果撤离点未激活（虽然系统已激活），强制激活它
                    if (!evacPoint.active) {
                        console.log('强制激活撤离点（玩家已进入范围）');
                        evacPoint.active = true;
                        // 更新视觉效果
                        if (evacPoint.zoneGraphic) {
                            evacPoint.zoneGraphic.clear();
                            evacPoint.zoneGraphic.fillStyle(0x00ff00, 0.15);
                            evacPoint.zoneGraphic.fillCircle(0, 0, evacRadius);
                            evacPoint.zoneGraphic.lineStyle(4, 0x00ff00, 0.6);
                            evacPoint.zoneGraphic.strokeCircle(0, 0, evacRadius);
                            evacPoint.zoneGraphic.setAlpha(1);
                        }
                        if (evacPoint.graphic) {
                            evacPoint.graphic.clear();
                            evacPoint.graphic.fillStyle(0x00ff00, 0.5);
                            evacPoint.graphic.fillCircle(0, 0, 20);
                            evacPoint.graphic.lineStyle(3, 0x00ff00, 1);
                            evacPoint.graphic.strokeCircle(0, 0, 20);
                            evacPoint.graphic.lineStyle(3, 0xffffff, 1);
                            evacPoint.graphic.lineBetween(-15, 0, 15, 0);
                            evacPoint.graphic.lineBetween(0, -15, 0, 15);
                        }
                        if (evacPoint.labelText) {
                            evacPoint.labelText.setText('撤离点');
                            evacPoint.labelText.setColor('#00ff00');
                            evacPoint.labelText.setVisible(false); // 隐藏标签，不一直显示
                        }
                    }
                    
                    // 检查是否需要特殊物品
                    if (evacPoint.requiredItems && evacPoint.requiredItems.length > 0) {
                        const hasRequiredItems = evacPoint.requiredItems.every(itemName => 
                            this.playerBackpack.some(item => item.name === itemName)
                        );
                        
                        if (!hasRequiredItems) {
                            this.evacuationText?.setText(
                                `需要物品: ${evacPoint.requiredItems.join(', ')}\n距离: ${Math.floor(dist)}`
                            );
                            // 清除倒计时
                            if (evacPoint.isCountdownActive) {
                                this.stopEvacuationCountdown(evacPoint);
                            }
                            return;
                        }
                    }
                    
                    // 显示标签（在范围内时）
                    if (evacPoint.labelText && evacPoint.active) {
                        evacPoint.labelText.setVisible(true);
                        evacPoint.labelText.setPosition(
                            evacPoint.x - this.cameras.main.scrollX,
                            evacPoint.y - this.cameras.main.scrollY - evacRadius - 30
                        );
                        evacPoint.labelText.setScrollFactor(0);
                    }
                    
                    // 开始或继续倒计时
                    if (!evacPoint.isCountdownActive) {
                        evacPoint.isCountdownActive = true;
                        evacPoint.countdown = 2; // 2秒倒计时（更快）
                        
                        // 创建圆环倒计时
                        this.startEvacuationCountdown(evacPoint);
                    }
                    
                    // 更新倒计时显示（在updateEvacuationPoints中处理递减）
                    if (evacPoint.countdown !== undefined) {
                        if (evacPoint.countdown > 0) {
                            this.updateEvacuationCountdownRing(evacPoint);
                            this.evacuationText?.setText(`正在撤离... ${Math.ceil(evacPoint.countdown)}秒`);
                        } else {
                            // 倒计时结束，自动撤离
                            this.completeEvacuation();
                        }
                    }
                } else if (dist < evacRadius + 50) {
                    // 接近但不在范围内
                    playerNearAnyEvacPoint = true;
                    if (!this.evacuationText?.text.includes('正在撤离')) {
                        this.evacuationText?.setText('接近撤离点\n进入绿色区域开始撤离');
                    }
                    // 显示标签（接近时）
                    if (evacPoint.labelText && evacPoint.active) {
                        evacPoint.labelText.setVisible(true);
                        evacPoint.labelText.setPosition(
                            evacPoint.x - this.cameras.main.scrollX,
                            evacPoint.y - this.cameras.main.scrollY - evacRadius - 30
                        );
                        evacPoint.labelText.setScrollFactor(0);
                    }
                    // 离开撤离点，重置倒计时
                    if (evacPoint.isCountdownActive) {
                        this.stopEvacuationCountdown(evacPoint);
                    }
                } else {
                    // 离开撤离点，重置倒计时并隐藏标签
                    if (evacPoint.isCountdownActive) {
                        this.stopEvacuationCountdown(evacPoint);
                    }
                    // 隐藏标签（远离时）
                    if (evacPoint.labelText) {
                        evacPoint.labelText.setVisible(false);
                    }
                }
            });
            
            // 如果玩家不在任何撤离点附近，清除提示
            if (!playerNearAnyEvacPoint && this.evacuationText) {
                if (this.evacuationText.text.includes('接近') || this.evacuationText.text.includes('撤离')) {
                    this.evacuationText.setText('');
                }
            }
            
        } catch (error) {
            console.error('检查撤离状态时出错:', error);
        }
    }
    
    // 开始撤离倒计时圆环
    private startEvacuationCountdown(evacPoint: EvacuationPoint) {
        try {
            // 创建倒计时圆环（如果不存在）
            if (!evacPoint.countdownRing) {
                evacPoint.countdownRing = this.add.graphics();
                evacPoint.countdownRing.setDepth(45); // 在撤离点上方
            }
        } catch (error) {
            console.error('创建倒计时圆环时出错:', error);
        }
    }
    
    // 更新撤离倒计时圆环
    private updateEvacuationCountdownRing(evacPoint: EvacuationPoint) {
        try {
            if (!evacPoint.countdownRing || evacPoint.countdown === undefined) return;
            
            const progress = evacPoint.countdown / 2; // 2秒倒计时，progress是剩余时间的比例
            const radius = 80; // 圆环半径
            // 使用撤离点的位置，而不是玩家位置
            const centerX = evacPoint.x;
            const centerY = evacPoint.y;
            
            // 清除并重绘圆环（美化版）
            evacPoint.countdownRing.clear();
            evacPoint.countdownRing.setPosition(centerX, centerY);
            
            // 绘制外圈发光效果（绿色光晕）
            evacPoint.countdownRing.fillStyle(0x00ff00, 0.15);
            evacPoint.countdownRing.fillCircle(0, 0, radius + 10);
            
            // 绘制背景圆环（深灰色，带阴影效果）
            evacPoint.countdownRing.lineStyle(8, 0x222222, 0.6);
            evacPoint.countdownRing.beginPath();
            evacPoint.countdownRing.arc(0, 0, radius, 0, Math.PI * 2, false);
            evacPoint.countdownRing.strokePath();
            
            // 绘制内层背景圆环（更亮的灰色）
            evacPoint.countdownRing.lineStyle(6, 0x444444, 0.4);
            evacPoint.countdownRing.beginPath();
            evacPoint.countdownRing.arc(0, 0, radius - 2, 0, Math.PI * 2, false);
            evacPoint.countdownRing.strokePath();
            
            // 绘制绿色进度圆环（从顶部开始，顺时针减少）
            if (progress > 0) {
                const startAngle = -Math.PI / 2; // 从顶部开始（-90度）
                const sweepAngle = Math.PI * 2 * progress; // 剩余时间对应的角度
                const endAngle = startAngle + sweepAngle; // 结束角度
                
                // 外层进度圆环（粗，半透明）
                evacPoint.countdownRing.lineStyle(8, 0x00ff00, 0.5);
                evacPoint.countdownRing.beginPath();
                evacPoint.countdownRing.arc(0, 0, radius, startAngle, endAngle, false); // false表示顺时针
                evacPoint.countdownRing.strokePath();
                
                // 内层进度圆环（细，高亮）
                evacPoint.countdownRing.lineStyle(6, 0x00ff00, 1);
                evacPoint.countdownRing.beginPath();
                evacPoint.countdownRing.arc(0, 0, radius - 2, startAngle, endAngle, false);
                evacPoint.countdownRing.strokePath();
                
                // 进度端点高光（白色点）
                const endX = Math.cos(endAngle) * radius;
                const endY = Math.sin(endAngle) * radius;
                evacPoint.countdownRing.fillStyle(0xffffff, 1);
                evacPoint.countdownRing.fillCircle(endX, endY, 5);
                evacPoint.countdownRing.fillStyle(0x00ff00, 1);
                evacPoint.countdownRing.fillCircle(endX, endY, 3);
            }
            
            evacPoint.countdownRing.setVisible(true);
            
        } catch (error) {
            console.error('更新倒计时圆环时出错:', error);
        }
    }
    
    // 停止撤离倒计时
    private stopEvacuationCountdown(evacPoint: EvacuationPoint) {
        try {
            evacPoint.isCountdownActive = false;
            evacPoint.countdown = undefined;
            
            if (evacPoint.countdownRing) {
                evacPoint.countdownRing.clear();
                evacPoint.countdownRing.setVisible(false);
            }
            
            if (evacPoint.countdownText) {
                evacPoint.countdownText.setVisible(false);
            }
        } catch (error) {
            console.error('停止倒计时时出错:', error);
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
                // 清空背包（死亡后物品全部遗失）
                this.playerBackpack = [];
                
                // 重启场景
                this.scene.restart();
            });
            
        } catch (error) {
            console.error('游戏结束处理时出错:', error);
        }
    }
}