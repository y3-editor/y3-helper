export const ER_PROMPT = `这里有一段源代码或描述，请你理解它的实现逻辑，根据实体关系 (ER) 模型生成 Mermaid erDiagram 语法的图表字符串。

要求如下：
表名： 表名使用大写字母表示，例如：User。 
属性名称： 属性名称使用小写字母表示，前面加上数据类型。 
不包含特殊符号。 例如，整型属性id表示为：int id。
表与表之间的关系： 使用Mermaid erDiagram中正确的关系符号表示，例如：||--o{ 表示一对多关系。
表与属性的组织： 表与其属性保持在一起，在同一块表示。
关系说明： 明确说明表之间的关联角色。 
去除非标准修饰符： 确保去掉所有非标准的修饰符，使得代码完全符合Mermaid的ER图标准。
关系单独定义： 实体之间的关系应该在实体定义之外单独写出。
分隔实体定义和关联关系定义： 将实体定义与关联关系定义分开以避免混淆和语法错误。 
终止条件： 确保生成的代码严格按照Mermaid erDiagram语法，没有多余的结束大括号 }。
例子：

erDiagram
  USER {
    int id
    string name
    string email
  }
  
  POST {
    int id
    string title
    string content
    int user_id
  }
  
  USER ||--o{ POST : "has"
  
  CUSTOMER {
    int customerId
    string customerName
    string email
  }
  
  ORDER {
    int orderId
    date orderDate
    int customer_id
  }
  
  ORDER ||--o{ PRODUCT : "contains"
  ORDER ||--o{ CUSTOMER : "places"

注意：
请确保关系角色明确且格式正确。
验证生成的代码是否符合Mermaid erDiagram的语法。
不要在最后添加多余的 }
返回代码

输入如下：\n`;

export const CLASS_PROMPT = `这里有一段源代码或描述，请你理解它的实现逻辑，生成一个类图(classDiagram)，使用mermaid语法：

生成规则：
定义类：每个类包括类名、成员变量和成员方法。
成员变量：用减号 - 开头，表示为私有变量，并指明数据类型。
成员方法：用加号 + 开头，表示为公共方法，并指明参数及其数据类型。
命名法：使用驼峰命名法或下划线命名法来定义变量和方法名。
换行分隔：成员变量和成员方法之间用换行分隔。
类之间的关系：
使用 "1", "*" 等符号表示一对一、多对多等关系。
使用箭头 --> 或其他Mermaid支持的关系符号来描述类之间的关系。
缩进和格式：确保每个类及其成员有相应的缩进，保持代码的可读性。
代码块：多行代码块中以 classDiagram 开头，确保正确的Mermaid格式。
示例：
classDiagram
    class ClassName {
        - memberVariable1: DataType
        - memberVariable2: DataType
        + memberFunction1(parameter: DataType)
        + memberFunction2(parameter: DataType)
    }

    class AnotherClass {
        - anotherVariable: DataType
        + anotherFunction(parameter: DataType)
    }

    ClassName "1" --> "*" AnotherClass : has

注意：
确保关系角色明确且格式正确。
验证生成的代码是否符合Mermaid classDiagram的语法。
返回代码。


输入如下：\n`;

export const CFG_PROMPT = ` 生成控制流图 (CFG) 的 Mermaid 流程图字符串，请遵循以下要求：

1. 节点命名：使用字母（A、B、C 等）作为节点名称。
2. 节点内容：节点的文本内容应使用中英文描述，并用双引号括起来。
3. 连线条件：节点间连线的条件文本也需用双引号括起。

示例：
graph TD
    A["开始/Start"] --> B["检查条件/Check Condition"]
    B -- "是/Yes" --> C["执行操作/Execute Action"]
    B -- "否/No" --> D["结束/End"]

注意：
1. 确保 Mermaid 流程图逻辑正确，代表控制流图 (CFG)。
2. 节点描述使用中英文，不含特殊符号，并详细描述每个节点的具体操作或功能。
3. 节点功能的简明描述应清晰、明了。
4. 节点功能的详细描述与代码片段应对应正确。
5. 确保代码片段中的特殊字符已转义。
6. 记录代码片段起始行数准确。
7. 返回代码
    
以下是需要理解并处理的代码: \n`;

export const SEQUENCE_PROMPT = `请帮助我用 Mermaid 语法创建一个序列图，详细描述以下过程：

参与者:

列出所有参与者。
交互步骤:

描述每个参与者之间的交互。
使用箭头（->>）表示参与者之间的消息传递。
使用 activate 和 deactivate 表示参与者的活动状态变化。
循环和条件:

使用 loop 描述循环结构，明确循环条件。
使用 if-else 描述条件分支，每个分支的动作使用箭头引导。
错误处理:

描述可能的异常情况及其处理方式。
返回结果:

描述如何结束流程及返回结果。
请将上述信息格式化成 Mermaid 序列图代码。

示例: sequenceDiagram
    participant User
    participant System
    participant Database

    User->>System: Request data
    activate System
    System->>Database: Query for data
    activate Database
    Database->>System: Return data
    deactivate Database

    alt Data found
        System->>User: Deliver data
    else No data found
        System->>User: Notify no data
    end

    deactivate System
    User->>User: Process response

注意：
1.  返回代码
    
    
  以下是需要理解并处理的代码: \n`;

export const MINDMAP_PROMPT = `生成思维导图 (MindMap) 的 Mermaid 图表字符串，请遵循以下要求：

1. 节点命名：每个节点使用简单且描述性的名称。
2. 唯一根节点：确保只有一个根节点，并从此节点展开所有子节点。
3. 子节点层次结构：使用缩进表示节点的层次关系。
4. 节点内容：节点的文本内容用引号括起，确保易读性。

示例：

mindmap
  root("唯一主主题")
    子主题一("子主题一")
      子主题一一("子主题一一")
      子主题一二("子主题一二")
    子主题二("子主题二")
      子主题二一("子主题二一")

注意：
1. 确保只有一个根节点，其他节点作为其子节点。
2. 节点描述应清晰明了，反映信息的层次性。
3. 各层级的节点应正确缩进，保持结构的直观性。
4. 输出确保符合 mermaid 图表语法的代码。
5. 输出代码！

以下是需要理解并处理的信息：\n`;
