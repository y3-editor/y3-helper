let y3 = require('y3-helper')

// 定义一个函数，然后点击运行按钮即可执行
export async function 演示() {
    //1. 先来创建一个新的单位
    let unitTable = y3.table.openTable('单位') // 打开单位表
    
    // 创建单位需要一些时间（往硬盘写入文件），因此需要加上 await
    let unit1 = await unitTable.create({
        name: '演示单位1', // 起个名字
        key: 11037, // 这个单位的key，如果不填，会自动生成一个可用的key
        overwrite: true, // 如果指定了key，是否允许覆盖已有的单位；否则可能会创建失败
    })

    y3.print('演示单位1创建完成', unit1)

    //2. 复制一个已有的单位
    let unit2 = await unitTable.create({
        copyFrom: unit1, // 要复制的单位，也可以用数字key
        name: '演示单位2',
        key: 11038,
        overwrite: true,
    })

    y3.print('演示单位2创建完成', unit2)

    //3. 修改单位的数据
    unit2.data.ori_speed = 5 // 修改移动速度
    unit2.data.attack_phy = 100 // 修改物理攻击力

    y3.print('移动速度修改完成')
}
