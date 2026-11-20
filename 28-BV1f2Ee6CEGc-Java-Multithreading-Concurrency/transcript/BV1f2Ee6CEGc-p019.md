[00:00] Well, how do everyone? In the previous video, we wrote code in IntelliJ. So I figure in this video, we need to write code for locks and conditions using IntelliJ. All right, let's get to it. So here I'm opening up IntelliJ and I want to create a class named shared buffer with lock.
[00:27] So what's the purpose of lock and condition? Well you remember previously we used synchronized to control access to the shared buffer and wait and notify for thread communication. However lock and condition actually provide more granular control allowing things like
[00:53] multiple conditioned variables for complex scenarios, more flexibility with explicit locking and unlocking, as well as the ability to implement fair locking policies. So here I will create data. And this is the shared resource between the producer and the consumer. And I want to create a has data to check if the buffer has data.
[01:21] for example whether the producer has placed any data for the consumer, and I will create a re-entrant lock object. So a re-entrant lock is used to lock the buffer when either the producer or a consumer is accessing it.
[01:48] Create condition object and lock dot new condition. The condition is used for thread signaling. It allows threads to wait and signal when appropriate, similar to wait and notify, but more flexible.
[02:16] Lock dot lock. The producer locks the buffer before accessing it, ensuring no other thread can modify it at the same time.
[02:38] condition.await. If the buffer already has data, the producer waits using await.
[03:04] And this replaces Wade in the previous version.
[03:21] Condition dot signal. After producing data, the producer signals the consumer using signal, which is similar to notify. And this tells the consumer that new data is available for consumption.
[03:51] And finally, block.
[04:06] So we always call lock.unlock in a finally block to make sure that the lock is released even if an exception occurs and this ensures that we avoid deadlocks or
[04:32] Locking issues. Lock dot lock.
[04:57] The consumer locks the buffer before accessing it to ensure exclusive access. Condition dot a weight. The consumer waits if the buffer is empty using a weight instead of weight.
[05:21] The consumer thread will be paused until the producer signals it.
[05:37] Condition dot signal. After consuming the data, the consumer calls signal to notify the producer that the buffer is empty and ready for new data. Lock dot unlock.
[06:07] A lock is released after the consumer is done ensuring other threads can access the buffer. So we create an instance of shared buffer with lock.
[06:17] that both a producer and consumer threads will use.
[06:46] you
[07:01] you
[07:31] For producer thread, while the producer generates values from zero to four, adding them to the shared buffer.
[07:56] And we use thread dot sleep to simulate the time delays between producing and consuming.
[08:15] Consumer thread.
[08:36] The consumer.
[08:48] Retrieves values from the buffer.
[09:08] We start the producer and consumer threads, letting them run concurrently. The producer produces data.
[09:36] and the consumer consumes it in coordination using lock and condition mechanisms. Executor flow, the producer produces values and weights if the buffer is full. The consumer consumes values and weights if the buffer is empty. They use condition.await and condition.signal in order to signal each other when it's time to produce or consume.
[10:03] and both reds work in synchronization thanks to the lock mechanism. So when you run the code you'll see output like this on the console. Well thank you very much for your attention.
[10:31] See you next time.
