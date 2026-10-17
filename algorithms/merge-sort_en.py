values = [18, 37,  3, 13, 10, 11, 31,  7, 17, 33,
           6, 38,  4, 14, 35, 26, 22, 39,  9, 25,
          19,  5,  2, 12, 23, 24,  1,  8, 28, 30,
          36, 16, 34, 20, 15, 29, 27, 32, 40, 21] #l#

n = len(values) #t#

# Remove the element at index k
# and reinsert it at index l
def reinsert(k, l): #s#
    values.insert(l, values.pop(k))

def merge(start, middle, end): #tv(start:1,middle:2,end:4)#
    middle_start = middle + 1 #tv(3)#

    if values[middle] <= values[middle_start]:
        return

    while start <= middle and middle_start <= end:
        if values[start] <= values[middle_start]:
            start += 1
        else:
            reinsert(middle_start, start)
            start += 1
            middle += 1
            middle_start += 1

def merge_sort(start, end): #td(start-end)#
    if start >= end:
        return

    middle = start + (end - start) // 2 #t#

    merge_sort(start, middle)
    merge_sort(middle + 1, end)

    merge(start, middle, end)

merge_sort(0, n - 1)
