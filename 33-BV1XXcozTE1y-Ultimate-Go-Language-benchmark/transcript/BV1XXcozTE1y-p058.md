[00:00] Lesson nine begins our journey in learning how to deal with a really nasty class of bugs in multi-threaded software development called data races. Data races is when we have
[00:29] multiple go routines trying to access the same memory location at the same time and not really cooperating or taking a turn. These are nasty, nasty types of bugs. So in this lesson we're going to start learning about atomic instructions in mutexes and I'm going to give you guidelines along the way that should help you hopefully prevent you from making some obvious data races but eventually allow you to
[00:57] handle some more complex ones if they end up finding themselves in your code.
[01:03] you
