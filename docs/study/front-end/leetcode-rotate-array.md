# LeetCode 189. 轮转数组

## 题目描述

给定一个整数数组 `nums`，将数组中的元素向右轮转 `k` 个位置，其中 `k` 是非负数。

### 示例

**示例 1:**
```
输入: nums = [1,2,3,4,5,6,7], k = 3
输出: [5,6,7,1,2,3,4]
解释:
向右轮转 1 步: [7,1,2,3,4,5,6]
向右轮转 2 步: [6,7,1,2,3,4,5]
向右轮转 3 步: [5,6,7,1,2,3,4]
```

**示例 2:**
```
输入: nums = [-1,-100,3,99], k = 2
输出: [3,99,-1,-100]
解释:
向右轮转 1 步: [99,-1,-100,3]
向右轮转 2 步: [3,99,-1,-100]
```

### 提示

- 1 <= nums.length <= 10^5
- -2^31 <= nums[i] <= 2^31 - 1
- 0 <= k <= 10^5

## 解题思路

这道题有多种解法，我将介绍一种高效的解法：**三次翻转法**。

### 三次翻转法原理

三次翻转法的核心思想是：
1. 整体翻转：将数组完全翻转，使得原数组的后k个元素移动到数组的前面
2. 翻转前k个元素：将前k个元素翻转，恢复它们原有的顺序
3. 翻转剩余元素：将剩余的元素翻转，恢复它们原有的顺序

这种方法的时间复杂度为O(n)，空间复杂度为O(1)，非常高效。

### 图解过程

以数组 `[1,2,3,4,5,6,7]` 和 `k=3` 为例：

```
原始数组:     [1, 2, 3, 4, 5, 6, 7]
第一步 - 整体翻转: [7, 6, 5, 4, 3, 2, 1]
第二步 - 翻转前k个: [5, 6, 7, 4, 3, 2, 1]
第三步 - 翻转剩余: [5, 6, 7, 1, 2, 3, 4]
最终结果:     [5, 6, 7, 1, 2, 3, 4]
```

## 代码实现

### JavaScript实现

```javascript
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {void} Do not return anything, modify nums in-place instead.
 */
var rotate = function(nums, k) {
    // 处理k大于数组长度的情况
    k %= nums.length;
    
    // 辅助函数：翻转数组指定范围内的元素
    const reverse = (start, end) => {
        while (start < end) {
            [nums[start], nums[end]] = [nums[end], nums[start]];
            start++;
            end--;
        }
    };
    
    // 第一次翻转：整体翻转
    reverse(0, nums.length - 1);
    
    // 第二次翻转：翻转前k个元素
    reverse(0, k - 1);
    
    // 第三次翻转：翻转剩余元素
    reverse(k, nums.length - 1);
};
```

### Java实现

```java
public class Solution {
    public void rotate(int[] nums, int k) {
        k %= nums.length;
        reverse(nums, 0, nums.length - 1);
        reverse(nums, 0, k - 1);
        reverse(nums, k, nums.length - 1);
    }
    
    private void reverse(int[] nums, int start, int end) {
        while (start < end) {
            int temp = nums[start];
            nums[start] = nums[end];
            nums[end] = temp;
            start++;
            end--;
        }
    }
}
```

### Python实现

```python
def rotate(nums, k):
    """
    :type nums: List[int]
    :type k: int
    :rtype: None Do not return anything, modify nums in-place instead.
    """
    n = len(nums)
    k %= n
    
    def reverse(start, end):
        while start < end:
            nums[start], nums[end] = nums[end], nums[start]
            start += 1
            end -= 1
    
    # 三次翻转
    reverse(0, n - 1)
    reverse(0, k - 1)
    reverse(k, n - 1)
```

## 复杂度分析

- **时间复杂度**: O(n)，其中 n 是数组的长度。每个元素被翻转两次，一共 2n 次操作。
- **空间复杂度**: O(1)，只使用了常数级别的额外空间。

## 其他解法

### 方法一：使用额外数组

这是最直观的方法，创建一个新数组，然后将原数组的元素按正确的位置放到新数组中。

```javascript
var rotate = function(nums, k) {
    const n = nums.length;
    const newArr = new Array(n);
    for (let i = 0; i < n; ++i) {
        newArr[(i + k) % n] = nums[i];
    }
    for (let i = 0; i < n; ++i) {
        nums[i] = newArr[i];
    }
};
```

- 时间复杂度：O(n)
- 空间复杂度：O(n)

### 方法二：环形替换

通过数学方法找到元素应该放置的位置，直接进行替换。

```javascript
var rotate = function(nums, k) {
    const n = nums.length;
    k %= n;
    let count = 0;
    for (let start = 0; count < n; start++) {
        let current = start;
        let prev = nums[start];
        do {
            const next = (current + k) % n;
            const temp = nums[next];
            nums[next] = prev;
            prev = temp;
            current = next;
            count++;
        } while (start !== current);
    }
};
```

- 时间复杂度：O(n)
- 空间复杂度：O(1)

## 总结

轮转数组是一道经典的算法题，考察了对数组操作的理解和优化能力。三种主要解法各有特点：

1. **三次翻转法**：最优解，空间复杂度最低，代码简洁易懂
2. **使用额外数组**：最容易理解，但需要额外空间
3. **环形替换**：较为复杂，但也是原地操作

在面试中，推荐使用三次翻转法，因为它既高效又容易解释清楚思路。