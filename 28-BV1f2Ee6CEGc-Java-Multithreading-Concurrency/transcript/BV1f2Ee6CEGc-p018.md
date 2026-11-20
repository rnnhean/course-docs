[00:00] Well hello everybody, welcome back. So in that previous video we were talking about thread coordination. So that means in this video we'll be talking about inter thread communication using IntelliJ. But first we need to have a little chat about inter thread communication. You see when multiple threads are working together
[00:24] There are times when one thread might need to pause execution and wait for another thread to complete its task. This is where EnterThread communication comes in. In Java, threads can communicate using the Wait, Notify, and NotifyAll methods, which are part of the Object class.
[00:47] These are the methods that are used to coordinate execution between threads that are working on shared resources. Alright, so let's talk about how they work. When a thread calls wait, it releases the lock on the object it's holding and enters a waiting state. The thread will stay in this state until another thread calls notify or
[01:14] notify all on the same object. See, notify wakes up one waiting thread. The thread will then attempt to reacquire the lock on the object and continue execution. And then notify all wakes up all waiting threads. But they're going to compete to acquire the lock and proceed with their execution.
[01:41] So here I open up IntelliJ and I'm going to create a new project named producer consumer example here. So we're going to solve a classic multi-threading problem. This is the producer consumer problem.
[02:10] Now in this problem two threads, a producer and a consumer share a resource, like in our case a buffer. The producer adds items to the buffer and the consumer removes items. Pretty simple so far. But the key is ensuring that they coordinate properly so that the producer doesn't add data when the buffer is full and the consumer doesn't try to remove data when the buffer is empty, right? Okay, so we define a shared buffer.
[02:39] where the data is the resource being shared between the producer and the consumer. The Boolean has data flag gets used to keep track.
[03:05] of whether the buffer is full, for example, data is available for consumption. Then, the produce method simulates the action of the producer adding data to the shared buffer. Now the method is also synchronized.
[03:31] so that only one thread can access it at a time. The while has data loop ensures that the producer waits when the buffer is full. The wait method pauses the producer thread.
[03:47] until it's notified by the consumer.
[04:08] Then once the data is produced, as data is set to true, and notify is called to wake up the consumer thread,
[04:37] that's been waiting to consume the data. So the consume method allows the consumer to retrieve the data from the shared buffer.
[05:05] And here we've got the while no equals has data loop. This makes the consumer wait if there's no data to consume. And it'll wait until the producer notifies that it's got data available.
[05:35] So once the data is consumed, has data get set to false, indicating the buffer is now empty, and the consumer calls notify to wake up the producer thread? All right, so that's...
[06:04] How the buffer works. Let's see how to create the producer and consumer threads and start them in our main method.
[06:17] So what we'll do is create an instance of shared buffer that both the producer and consumer will use.
[06:45] The producer thread generates five values, zero to four, and calls produce.
[07:09] to add each value to the shared buffer. We use Threadsleep putting 500 to simulate a delay, which helps us to see the
[07:30] Synchronization in action.
[07:40] The consumer thread calls consume to retrieve and process the data from the shared buffer.
[08:10] And we'll use ThreadSleep.
[08:28] putting 800 to simulate a longer time delay for consumption than for production. And this will demonstrate how the weight notify methods help the threads wait for each other. So we start both the
[08:56] producer and consumer threads. The producer produces the data, and the consumer consumes it, all while coordinating their actions using Wait and Notify. The producer starts and produces a value, places it in the buffer, and then waits until the consumer consumes it.
[09:23] The consumer consumes a value. Set has data equals false and notifies the producer to produce the next value. Then this process will repeat until all values are produced and consumed. So when you run this code, you're going to see the output where the producer and consumer coordinate with each other. And this ensures that
[09:51] The producer only produces when the buffer is empty. And the consumer only consumes when the buffer has data. All right, so there you go. That's how to implement producer-consumer problems. In the next video, we're going to learn how to implement locks and conditions using IntelliJ. I'll see you on the other side.
[10:16] you
