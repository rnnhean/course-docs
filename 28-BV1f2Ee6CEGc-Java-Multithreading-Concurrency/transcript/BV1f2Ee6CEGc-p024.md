[00:00] Well, hello, my friends. Welcome back. So now it's time that we talk about thread contention and deadlocks. We'll start with thread contention. And thread contention basically occurs when multiple threads compete for shared resources, such as locks or variables. Now, this can lead to delays as threads wait their turn to access the resource.
[00:25] Thread contention can significantly degrade performance in highly concurrent applications if not managed properly. And some of the most common causes of thread contention, overuse of synchronized blocks or methods, threads waiting for IO operations to complete, competition for locks and data structures like HashMap or file handlers. So that's why we've got to reduce contention.
[00:53] Minimize the scope of locks. Use concurrent data structures like concurrent hash map. Optimize the critical sections of your code. Yeah, that's why that's third in priority. Let's talk about the deadlocks. So deadlocks occur when two or more threads are stuck waiting for each other to release the resources they need to proceed. Classic deadlock example.
[01:20] involves a couple of threads holding one lock each and waiting to acquire the other lock. Okay. So of course there are ways to avoid deadlocks. You avoid nested locks. So in other words, you don't lock one resource while holding another. Lock ordering. So ensure all threads acquire locks in the same order. Use timeouts. Employ try lock with a timeout.
[01:49] to avoid indefinite waiting. Now guess what? We're going to move on to IntelliJ and get some practice time in. All right, good. So going to first want to create a Java project named Performance and Scalability.
[02:12] So in this project, let's create a Java class called thread contention example. And let's just go ahead and add the main method and the example that
[02:38] We'll make, we'll demonstrate how multiple threads contend for a shared resource using a re-entrant lock. Now each thread is gonna try to acquire the lock, perform some work, and then release it. And you'll see how third contention impacts execution order. So first, I wanna use the re-entrant lock class to create a lock.
[03:07] And this will control access to a critical section. After that, I need to define a shared resource. So I'll create a counter variable as my shared resource. Now I'll define the tasks for threads using Runnable. Now the Runnable...
[03:34] will simulate thread contention. Each thread will acquire the lot, increment the counter, print its status, release the lot in that order. All right, let's create it now.
[03:53] All right, so I'll just create and start multiple threads using Runable to simulate contention.
[04:23] you
[04:53] you
[05:08] you
[05:38] you
[06:08] Okay, so let's run it and see what happens. We can examine the output. Thread 1 acquires a lock and enters the critical section. It increments a shared counter, prints the message, releases the lock. Releasing a lock allows another thread to acquire it.
[06:37] After thread one releases a lock, thread three acquires it. It performs the same actions as thread one. Increments a counter, prints its message, and releases a lock. Thread two follows the same pattern as the previous threads, acquires a lock, increments a counter, prints the message, and releases a lock. So now, considering this output, let's talk about this thread contention.
[07:05] So we've got serialized access to the counter. Only one thread accesses the shared counter at any given time. This is insured by the use of re-entrant lock, which prevents simultaneous access to the critical section. No overlaps in thread execution. The output shows that each thread completes its work before the next thread begins. This demonstrates proper thread synchronization and lock management.
[07:35] Also, fairness in lock access. The threads acquire the lock in a seemingly fair order, though in practice, fairness is not guaranteed unless explicitly requested when initializing the lock. New re-entrant lock imprints is true. So the order observed here is likely due to thread scheduling by the JVM.
[08:03] Now the critical section as the code increments the counter and prints the message. Because this section is protected by a lock, it ensures that the counter is incremented without interference from other threads. The thread prints its message without getting interrupted. So if threads try to acquire the lock simultaneously, the following may occur. One thread, for example, thread one.
[08:31] acquires the lock and starts execution. Other threads, maybe thread two and thread three are going to be forced to wait until the lock is released. So this orderly execution avoids race conditions as well as maintains data integrity. Okay, so that's the thread contention. Now let's take a look at deadlock.
[08:57] So a deadlock happens when two or more threads are waiting for each other to release the resources they need, causing the program to hang indefinitely. This usually involves circular dependencies between locks. Okay, so that's just a brief review. Let's just do the example. Now in the same project, I just want to create another class named a deadlock example.
[09:25] I'll use two re-entrant lock objects to simulate the dependency. Now, define the first task using Runnable.
[09:55] So with his task, thread one will acquire lock one first and then attempt to acquire lock two.
[10:06] Let's code.
[10:36] you
[10:50] you
[11:20] Okay, task one's ready. Now let's define the second task with the second task. Red two will acquire lock two first and then attempt to acquire lock one.
[11:44] Let's code that.
[12:13] you
[12:31] you
[13:00] Okay, so now I've got task two ready. Let's run both tasks simultaneously.
[13:22] to simulate the deadline. Okay, let's run it and I'm zero.
[13:50] Let's examine the first line. Thread 1 successfully acquires lock 1 and enters its first critical section. Then it attempts to acquire lock 2, but lock 2 is already held by thread 2. Thread 1 is now blocked, waiting for lock 2. Let's look at the second line. Thread 2 successfully acquires lock 2 and enters its first critical section.
[14:16] It then attempts to acquire lock one, but lock one is already held by thread one. Thread two is now blocked, waiting for lock one. So my friends, what happens next? Yeah, you're deadlocked. Neither thread can proceed because thread one, waiting for lock two, which is held by thread two, thread two is waiting for lock one, which is held by thread one. So that's what I mean by a circular dependency. Okay, so.
[14:45] The threads are stuck, right? Both threads are stuck indefinitely, unable to make progress. The program hangs at this point unless external intervention occurs. But that pretty much just means forcibly terminating one of the threads. Okay. That's as far as we're gonna get to right here, right now. So we'll take a break. Think on that. But I'll see you in the next video.
[15:13] you
