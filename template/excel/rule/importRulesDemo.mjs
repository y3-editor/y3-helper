// //Juntuan
// /*
//     * parameters：(物编类型，excel表相对路径，excel表sheet名)
//     * 物编数据所属的种类,现在可以填入以下几种类型：单位 装饰物 物品 技能 魔法效果 投射物 科技 可破坏物 声音
//  */
// /*
//     * parameters：(过滤字段，表头所在行数)
//     * 某一行如果填写了一个单独#说明这一行数据被注释掉
//  */
// /*
//     * parameters：(表头名，物编(代码)key，数据导出类型，数据填写类型(可选))
//     * 表头名：Excel表头名称
//     * 物编(代码)key：导出到物编json的索引key，后续有导出lua代码的需求，也是lua的索引key
//     * 数据导出类型：可以自定义导出数据的类型，如0，1可以导出为整数，也可以导出为布尔值
//     * 数据填写类型，规定数据是必须填写(REQUIRED)或者不填写时使用默认值(DEFAULT)等
// */
// /*
//     * 数据导出类型可以指定默认值，如果表中不填写数据则使用默认值
//     * 如果不指定当需要填写默认值的时候会填写数据类型的默认值，如Float的默认值为0
//     * Example:
//         itemRule.def('价格', 'price', Float(1.11111111), DEFAULT);
//  */
// /*
//     * ASTable可以用来修改导出key
//     * Example:
//         heroRule.def('人口', 'population', Int, ASTable('build_res_cost_list'));
//         heroRule.def('金钱', 'money', Int, ASTable('build_res_cost_list'));
//         在实际的导出文件中, 会被组合成 'build_res_cost_list': {'population': xx, 'money': xx}
//     * 也可以使用ASList(主要是物编中有中需求)
//     * Example:
//         heroRule.def('人口', 'population', Int, ASList('build_res_cost_list'));
//         heroRule.def('金钱', 'money', Int, ASList('build_res_cost_list'));
//         在实际的导出文件中, 会被组合成 'build_res_cost_list': [xx,xx]
// */
// /*
//     *List,Tuple 可以指定分割符号,List的可以指定数据类型(List中的数据类型应该都一样)，Tuple也可以指定
//     List和Tuple可以互相嵌套
//     * Example:
//         Tuple('|', Str, List(',', Int))
// */
// /*
//     用来指定数据导出到哪个json或者代码的主键，一个表中必须要要有一个且只有一个INDEX
//     如下例子，最总数据会导出到tower_id对应的.json文件中
//  */
// /*
//     * tmp方法是指定模板ID的列，一般来说是必须填写这一列的，也做了个保底如果没有这一字段则会从模板物编中生成一个json文件
//     * 在实际的导出文件中会根据填写的'模板ID'会寻找地图中已存在的物编数据，在Excel中定义的数据会覆盖模板数据
//     * Example:
// */
// /*
//     枚举对应
// */

